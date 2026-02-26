import AlarmPage from "./AlarmPage";

export default function PrincipalDashboard() {
  return (
    <AlarmPage
      preset="principal"
      title="Principal"
      description="Dashboard completo de alarmes e chamados do link principal, com faixas de tempo em horas e ofensores acima de 200h."
    />
  );
}
