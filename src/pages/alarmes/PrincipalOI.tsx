import AlarmPage from "./AlarmPage";

export default function PrincipalOI() {
  return (
    <AlarmPage
      preset="principal_oi"
      title="Principal - OI"
      description="Alarmes e chamados com Status contendo OI Legado ou Aguardando OI, enriquecidos com dados de circuito da aba MACRO."
    />
  );
}
