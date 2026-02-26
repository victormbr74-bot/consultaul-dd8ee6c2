import AlarmPage from "./AlarmPage";

export default function BackupDashboard() {
  return (
    <AlarmPage
      preset="backup"
      title="Backup"
      description="Dashboard completo de alarmes e chamados de backup, com faixas de tempo em horas e ofensores acima de 200h."
    />
  );
}
