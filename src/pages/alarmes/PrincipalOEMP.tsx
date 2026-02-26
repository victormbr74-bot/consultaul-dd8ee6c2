import AlarmPage from "./AlarmPage";

export default function PrincipalOEMP() {
  return (
    <AlarmPage
      preset="principal_oemp"
      title="Principal - OEMP"
      description="Alarmes (Falhas GIS) e chamados (Jira Abertos) com Status contendo OEMP, incluindo Empresa OEMP e Nº Incidente MAM."
    />
  );
}
