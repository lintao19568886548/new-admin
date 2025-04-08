interface Meta {
  title: string;
  icon?: string;
  activeMenu?: string;
  order?: number;
  affixTab?: boolean;
  keepAlive?: boolean;
  hideInTab?: boolean;
  hideChildrenInMenu?: boolean;
  hideInBreadcrumb?: boolean;
  badgeType?: string;
  badgeVariants?: string;
}

export interface Menu {
  name: string;
  path: string;
  title: string;
  children?: Menu[];
  meta?: Meta;
  type?: string;
  redirect?: string;
  status?: string;
  activePath?: string;
  authCode?: string;
}
