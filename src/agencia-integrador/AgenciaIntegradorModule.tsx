import { Outlet } from "react-router-dom";
import { AuthProvider } from "@/agencia-integrador/contexts/AuthContext";
import { DataProvider } from "@/agencia-integrador/contexts/DataContext";

export default function AgenciaIntegradorModule() {
  return (
    <AuthProvider>
      <DataProvider>
        <Outlet />
      </DataProvider>
    </AuthProvider>
  );
}

