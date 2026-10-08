import { useCallback, useState } from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon, ScrollView } from 'ming-ui';
import { Popover } from 'ming-ui/antd-components';
import type { SandboxProject } from 'src/components/AppSandbox/types';
import { emitter } from 'src/utils/platform/browser/dom';

const PROJECT_POPOVER_ALIGN = { offset: [0, 4] };

const ProjectTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  max-width: 500px;
  height: 30px;
  padding: 3px 5px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
  cursor: pointer;

  .companyName {
    min-width: 0;
  }

  .Icon {
    flex: none;
    margin-left: var(--space-1);
    color: var(--color-text-tertiary);
    font-size: var(--font-xl);
  }

  &:hover {
    background: var(--color-background-hover);
  }
`;

const ProjectsMenuCon = styled.div`
  width: 400px;
  padding: 5px 0;
`;

const ProjectOption = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  height: 40px;
  padding: 0 var(--space-5);
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: 500;
  line-height: 40px;
  text-align: left;
  cursor: pointer;

  &[aria-current='true'] {
    background: var(--color-primary-transparent);
    color: var(--color-primary);
  }

  &:not([aria-current='true']):hover {
    background: var(--color-background-hover);
  }
`;

const ProjectName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ProjectVersion = styled.span`
  flex: none;
  margin-left: 10px;
  color: var(--color-text-tertiary);
  font-size: var(--font-xs);
  font-weight: 400;
`;

const ScrollCon = styled(ScrollView)`
  height: ${({ $height }) => $height}px !important;
`;

export default function ProjectSwitch({
  currentProject,
  projects,
  onChange,
}: {
  currentProject: SandboxProject | undefined;
  projects: SandboxProject[];
  onChange: (project: SandboxProject) => void;
}) {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const handleSwitchProject = useCallback(
    (project: SandboxProject) => {
      setProjectMenuOpen(false);
      onChange(project);
      safeLocalStorageSetItem('currentProjectId', project.projectId);
      emitter.emit('CHANGE_CURRENT_PROJECT', project);
    },
    [onChange],
  );

  if (!currentProject) return null;

  const maxRows = Math.ceil((window.innerHeight - 110) / 40);
  let menuContent: React.ReactNode = projects.map(project => (
    <ProjectOption
      key={project.projectId}
      type="button"
      aria-current={project.projectId === currentProject.projectId ? 'true' : undefined}
      onClick={() => handleSwitchProject(project)}
    >
      <ProjectName>{project.companyName}</ProjectName>
      {_.get(project, 'version.name') && <ProjectVersion>{_.get(project, 'version.name')}</ProjectVersion>}
    </ProjectOption>
  ));

  if (projects.length > maxRows) {
    menuContent = <ScrollCon $height={maxRows * 40}>{menuContent}</ScrollCon>;
  }

  return (
    <Popover
      open={projectMenuOpen}
      content={<ProjectsMenuCon>{menuContent}</ProjectsMenuCon>}
      trigger="click"
      placement="bottomLeft"
      align={PROJECT_POPOVER_ALIGN}
      styles={{ container: { padding: 0 } }}
      onOpenChange={setProjectMenuOpen}
    >
      <ProjectTrigger type="button" aria-expanded={projectMenuOpen}>
        <span className="companyName overflow_ellipsis">{currentProject.companyName}</span>
        <Icon icon="arrow-down-border" />
      </ProjectTrigger>
    </Popover>
  );
}
