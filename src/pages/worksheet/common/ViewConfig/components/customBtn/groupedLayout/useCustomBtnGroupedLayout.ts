import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import { dialogSelectIcon } from 'ming-ui/functions';
import { GROUP_ICON_DIALOG_REF_FLUSH_MS } from './constants';
import { normalizeGroupIconForStorage } from './icon';
import {
  addGroupSegment,
  isTypedCompositeLayout,
  layoutToPayload,
  moveIdBetweenSegments,
  moveIdToSegmentBoundary,
  moveSegmentToIndex,
  removeGroupSegment,
  segmentsFromView,
} from './layoutUtils';
import type { ActiveGap, DropPlacement } from './dropPlacementTypes';

export default function useCustomBtnGroupedLayout({
  btnData,
  btnGroupsJson,
  flatBtnOrderJson,
  projectId,
  onSaveLayout,
}: { projectId?: string; [key: string]: any }) {
  const btnFingerprint = useMemo(() => (btnData || []).map(b => b.btnId).join(','), [btnData]);
  const iconDraftRef = useRef({});
  const segmentsRef = useRef([]);
  /** 落点 ref：写入形状见 dropPlacementTypes.DropPlacement（createBoundary/InsidePlacement 产出、clear 时置 null）。 */
  const activeDropPlacementRef = useRef<DropPlacement | null>(null);
  const onSaveLayoutRef = useRef(onSaveLayout);
  onSaveLayoutRef.current = onSaveLayout;

  const [segments, setSegments] = useState(() =>
    segmentsFromView(btnData, safeParse(flatBtnOrderJson, 'array'), safeParse(btnGroupsJson, 'array')),
  );
  /** 三者的真实写入值域：activeGap = ActiveGap | null；两个 insert = number | null（写入 placement.insertBefore 或 null）。 */
  const [activeGap, setActiveGap] = useState<ActiveGap | null>(null);
  const [activeGroupInsert, setActiveGroupInsert] = useState<number | null>(null);
  const [activeButtonInsert, setActiveButtonInsert] = useState<number | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(() => new Set());
  /** 真实值域：moreKey 字符串（`btn:${btnId}` / `group:${segmentIndex}` 等）或 null（关闭）。
   *  由 getNextOpenMoreKey 的返回值决定，见 constants.ts。 */
  const [openMoreKey, setOpenMoreKey] = useState<string | null>(null);
  const setActiveDropPlacement = useCallback((placement: DropPlacement | null) => {
    activeDropPlacementRef.current = placement;
  }, []);
  const clearActiveDropPlacement = useCallback(() => {
    activeDropPlacementRef.current = null;
  }, []);

  useEffect(() => {
    const flatArr = safeParse(flatBtnOrderJson, 'array');
    const groupArr = safeParse(btnGroupsJson, 'array');
    const nextSeg = segmentsFromView(btnData, flatArr, groupArr);
    setSegments(nextSeg);
    const { layoutItems } = layoutToPayload(nextSeg);

    if (_.isEqual(layoutItems, groupArr)) {
      return;
    }

    // 空布局或已是 typed 的 detailgroup/listgroup：补齐新按钮/新分组后写回，避免下次保存仍缺数据。
    if (!groupArr.length || isTypedCompositeLayout(groupArr)) {
      onSaveLayoutRef.current({ layoutItems });
    }
  }, [btnFingerprint, btnGroupsJson, flatBtnOrderJson]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const btnById = useMemo(() => _.keyBy(btnData || [], 'btnId'), [btnData]);
  const layoutDragStateRef = useRef({ segments: [], btnById: {} });
  layoutDragStateRef.current = { segments, btnById };

  const commit = useCallback(
    nextSegments => {
      setSegments(nextSegments);
      const { layoutItems } = layoutToPayload(nextSegments);
      onSaveLayout({ layoutItems });
    },
    [onSaveLayout],
  );

  const onDropOnGap = useCallback(
    (fromSi, fromIi, toSi, toIi) => {
      clearActiveDropPlacement();

      if (fromSi === toSi && fromIi === toIi) {
        setActiveGap(null);
        setActiveButtonInsert(null);
        return;
      }

      const next = moveIdBetweenSegments(segments, fromSi, fromIi, toSi, toIi);

      if (next !== segments) {
        commit(next);
      }

      setActiveGap(null);
      setActiveButtonInsert(null);
    },
    [segments, commit, clearActiveDropPlacement],
  );

  const onDropButtonToBoundary = useCallback(
    (fromSi, fromIi, insertBefore) => {
      clearActiveDropPlacement();

      const next = moveIdToSegmentBoundary(segments, fromSi, fromIi, insertBefore);

      if (next !== segments) {
        commit(next);
      }

      setActiveButtonInsert(null);
    },
    [segments, commit, clearActiveDropPlacement],
  );

  const onDropGroupSegment = useCallback(
    (fromSi, insertBefore) => {
      clearActiveDropPlacement();

      const next = moveSegmentToIndex(segments, fromSi, insertBefore);

      if (next !== segments) {
        commit(next);
      }

      setActiveGroupInsert(null);
      setActiveButtonInsert(null);
    },
    [segments, commit, clearActiveDropPlacement],
  );

  const handleAddGroup = useCallback(() => {
    iconDraftRef.current = {};
    dialogSelectIcon({
      projectId,
      name: _l('未命名分组'),
      icon: 'adds',
      iconColor: '#757575',
      hideColor: true,
      onModify: patch => {
        iconDraftRef.current = { ...iconDraftRef.current, ...patch };
      },
      onChange: ({ name, icon, iconColor }: { name?: string; icon?: string; [key: string]: any }) => {
        const trimmed = (name || '').trim();

        if (!trimmed) {
          return;
        }

        const chosenIcon = icon || 'adds';

        window.setTimeout(() => {
          const { iconUrl } = iconDraftRef.current;
          const url = iconUrl || '';
          commit(
            addGroupSegment(segmentsRef.current, {
              name: trimmed,
              icon: normalizeGroupIconForStorage(chosenIcon, url),
              iconUrl: url,
              iconColor: iconColor || '',
            }),
          );
        }, GROUP_ICON_DIALOG_REF_FLUSH_MS);
      },
    });
  }, [projectId, commit]);

  const handleRenameGroup = useCallback(
    (segmentIndex, newName) => {
      const next = segments.map((s, i) => (i === segmentIndex && s.type === 'group' ? { ...s, name: newName } : s));
      commit(next);
    },
    [segments, commit],
  );

  const handleRemoveGroup = useCallback(
    segmentIndex => {
      commit(removeGroupSegment(segments, segmentIndex));
    },
    [segments, commit],
  );

  const handleEditGroup = useCallback(
    si => {
      const seg = segments[si];

      if (!seg || seg.type !== 'group') {
        return;
      }

      iconDraftRef.current = { iconUrl: seg.iconUrl || '' };
      dialogSelectIcon({
        projectId,
        name: seg.name,
        icon: (seg.icon || 'adds').replace(/_svg$/, ''),
        iconColor: seg.iconColor || '#757575',
        hideColor: true,
        onModify: patch => {
          iconDraftRef.current = { ...iconDraftRef.current, ...patch };
        },
        onChange: ({ name, icon, iconColor }: { name?: string; icon?: string; [key: string]: any }) => {
          const trimmed = (name || '').trim();

          if (!trimmed) {
            return;
          }

          const chosenIcon = icon || 'adds';

          window.setTimeout(() => {
            const { iconUrl } = iconDraftRef.current;
            const url = iconUrl || '';
            const next = segmentsRef.current.map((s, i) =>
              i === si && s.type === 'group'
                ? {
                    ...s,
                    name: trimmed,
                    icon: normalizeGroupIconForStorage(chosenIcon, url),
                    iconUrl: url,
                    iconColor: iconColor || '',
                  }
                : s,
            );
            commit(next);
          }, GROUP_ICON_DIALOG_REF_FLUSH_MS);
        },
      });
    },
    [segments, projectId, commit],
  );

  const toggleGroupCollapsed = useCallback((groupId: string) => {
    setCollapsedGroupIds(prev => {
      const next = new Set(prev);

      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }

      return next;
    });
  }, []);

  return {
    segments,
    btnById,
    layoutDragStateRef,
    activeDropPlacementRef,
    activeGap,
    activeGroupInsert,
    activeButtonInsert,
    collapsedGroupIds,
    openMoreKey,
    setActiveGap,
    setActiveGroupInsert,
    setActiveButtonInsert,
    setActiveDropPlacement,
    clearActiveDropPlacement,
    setOpenMoreKey,
    onDropOnGap,
    onDropButtonToBoundary,
    onDropGroupSegment,
    handleAddGroup,
    handleRenameGroup,
    handleRemoveGroup,
    handleEditGroup,
    toggleGroupCollapsed,
  };
}
