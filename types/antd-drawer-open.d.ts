// Reviewable declaration only; not wired by this evidence file.
// antd 6.6.5: es/drawer/Drawer.js extracts/forwards open; rc Drawer defaults undefined to false.
// No top-level import/export: this is a global ambient external module, not augmentation.
declare module 'antd' {
  export * from 'antd/es';
  export type DrawerProps = Omit<import('antd/es/drawer').DrawerProps, 'open'> & {
    open?: import('antd/es/drawer').DrawerProps['open'] | undefined;
  };
  export const Drawer: ((props: DrawerProps) => ReturnType<typeof import('antd/es/drawer').default>) &
    Pick<typeof import('antd/es/drawer').default, keyof typeof import('antd/es/drawer').default>;
}
