import styled from 'styled-components';
import type { SandboxProject } from 'src/components/AppSandbox/types';
import ProjectSwitch from './ProjectSwitch';

const Header = styled.header`
  z-index: 10;
  display: flex;
  align-items: center;
  flex: none;
  box-sizing: border-box;
  height: 50px;
  padding: 0 30px;
  background: var(--color-background-card);
  box-shadow: var(--shadow-sm);
`;

export default function AppSandboxHeader({
  currentProject,
  projects,
  onProjectChange,
}: {
  currentProject: SandboxProject | undefined;
  projects: SandboxProject[];
  onProjectChange: (project: SandboxProject) => void;
}) {
  return (
    <Header>
      <ProjectSwitch currentProject={currentProject} projects={projects} onChange={onProjectChange} />
    </Header>
  );
}
