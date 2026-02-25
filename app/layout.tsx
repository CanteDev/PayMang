import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

import { getAppConfig } from "@/lib/config/server-config";

export async function generateMetadata(): Promise<Metadata> {
    // Only query company info. Avoid heavy queries here.
    const companyInfo = await getAppConfig('company_info', { name: "PayMang" });
    const companyName = companyInfo?.name || "PayMang";

    return {
        title: `${companyName} - Gestión de Comisiones`,
        description: "Sistema de gestión de ventas high-ticket con comisiones automatizadas",
    };
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <body className={inter.className}>{children}</body>
        </html>
    );
}
