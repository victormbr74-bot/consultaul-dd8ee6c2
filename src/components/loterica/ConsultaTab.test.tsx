import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import type { ReactNode } from "react";
import ConsultaTab from "@/components/loterica/ConsultaTab";

const baseForm = {
  cod_ul: "01-005481-2",
  nome_loterica: "LOTERICA TESTE",
  ccto_oi: "",
  raw_data: {},
};

const ConsultaTabHarness = ({ saveButton }: { saveButton?: ReactNode }) => {
  const [form, setForm] = useState<any>(baseForm);

  return (
    <>
      <ConsultaTab form={form} setForm={setForm} saveButton={saveButton} />
      <output data-testid="ccto-state">{form.ccto_oi}</output>
    </>
  );
};

const inputAfterLabel = (label: string) => {
  const labelNode = screen.getByText(label);
  const input = labelNode.parentElement?.querySelector("input,textarea");
  if (!input) throw new Error(`Input not found for ${label}`);
  return input as HTMLInputElement | HTMLTextAreaElement;
};

describe("ConsultaTab", () => {
  it("allows typing a complete value in principal fields", () => {
    render(<ConsultaTabHarness />);

    const cctoInput = inputAfterLabel("CCTO OI");
    fireEvent.change(cctoInput, { target: { value: "PALAVRA COMPLETA" } });

    expect(cctoInput).toHaveValue("PALAVRA COMPLETA");
    expect(screen.getByTestId("ccto-state")).toHaveTextContent("PALAVRA COMPLETA");
  });

  it("renders the save button in Dados Principal", () => {
    render(<ConsultaTabHarness saveButton={<button type="button">Salvar</button>} />);

    const principalTitle = screen.getByText("Dados Principal");
    const lotericaTitle = screen.getByText((content) => content.startsWith("Dados da Lot"));
    const saveButton = screen.getByRole("button", { name: "Salvar" });

    expect(principalTitle.closest(".rounded-lg")).toContainElement(saveButton);
    expect(lotericaTitle.closest(".rounded-lg")).not.toContainElement(saveButton);
  });
});
