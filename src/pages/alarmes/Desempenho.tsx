import AlarmPage from "./AlarmPage";

export default function Desempenho() {
  return (
    <AlarmPage
      preset="desempenho"
      title="Desempenho"
      description="Todos os alarmes da aba Falhas GIS com termo 'desempenho' em Categoria GIS (coluna L), usando duração (coluna J) como tempo em tela."
    />
  );
}
