import { useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { flatten } from 'lodash';
import type { ControlAdvancedSetting, FormControl } from 'src/utils/controlTypes';
import { genControlsByWidgets, genWidgetsByControls } from '../util';
import DisplayRow from './displayRow';

interface PublicFormDisplayProps {
  controls: FormControl[];
  onChange: (controls: FormControl[], hiddenControlId?: string) => void;
  fromType?: 'public' | undefined;
  styleInfo?: { info?: ControlAdvancedSetting | undefined } | undefined;
}

export default function PublicFormDisplay({ controls, onChange, ...rest }: PublicFormDisplayProps) {
  const [widgets, setWidgets] = useState<FormControl[][]>([]);

  useEffect(() => {
    setWidgets(genWidgetsByControls(controls));
  }, [controls]);

  const [activeWidget, setActiveWidget] = useState<FormControl>({});

  const handleHide = (controlId: string) => {
    const nextControls = controls.filter(item => item.controlId !== controlId);
    onChange(nextControls, controlId);
  };

  const onSort = (list: FormControl[][]) => {
    setWidgets(list);
    onChange(genControlsByWidgets(list));
  };

  return (
    <DndProvider key="public" context={window} backend={HTML5Backend}>
      <DisplayRow
        widgets={widgets}
        setWidgets={onSort}
        activeWidget={activeWidget}
        setActiveWidget={setActiveWidget}
        handleHide={handleHide}
        allControls={flatten(widgets)}
        {...rest}
      />
    </DndProvider>
  );
}
