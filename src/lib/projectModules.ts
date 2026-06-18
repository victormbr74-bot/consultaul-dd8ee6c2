export type ProjectModuleItem = {
  id: string;
  label: string;
  path: string;
};

export type ProjectModule = {
  id: string;
  label: string;
  description: string;
  items: ProjectModuleItem[];
};

export const projectModules: ProjectModule[] = [
  {
    id: "consulta-massiva",
    label: "Consulta Massiva GIS",
    description: "Analise GIS, massivas, operadoras, escalonamentos e auditoria.",
    items: [
      { id: "analise", label: "Analise", path: "/" },
      { id: "operadoras", label: "Operadoras", path: "/admin/operadoras" },
      { id: "escalonamentos", label: "Escalonamentos", path: "/admin/escalonamentos" },
      { id: "cidades", label: "Cidades / Geo", path: "/admin/cidades" },
      { id: "usuarios", label: "Usuarios", path: "/admin/usuarios" },
      { id: "auditoria", label: "Auditoria", path: "/admin/auditoria" },
    ],
  },
  {
    id: "controle-reparo",
    label: "Controle de Reparo",
    description: "Importacoes, dashboard, controle operacional, implantacao e casos.",
    items: [
      { id: "dashboard", label: "Dashboard", path: "/dashboard" },
      { id: "importacoes", label: "Importacoes", path: "/importacoes" },
      { id: "controle", label: "Controle Operacional", path: "/controle" },
      { id: "meus-casos", label: "Meus Casos", path: "/meus-casos" },
      { id: "implantacao", label: "Implantacao", path: "/implantacao" },
      { id: "admin", label: "Admin Master", path: "/admin" },
    ],
  },
];

export function getProjectModule(projectId?: string) {
  return projectModules.find((project) => project.id === projectId) ?? null;
}

export function getProjectModuleItem(project: ProjectModule | null, itemId?: string) {
  if (!project) return null;
  return project.items.find((item) => item.id === itemId) ?? project.items[0] ?? null;
}
