import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define styles
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    header: {
        marginBottom: 30,
        borderBottomWidth: 2,
        borderBottomColor: '#1a365d',
        borderBottomStyle: 'solid',
        paddingBottom: 15,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a365d',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1a365d',
        marginBottom: 8,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#cbd5e1',
        borderBottomStyle: 'solid',
    },
    row: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    label: {
        fontSize: 10,
        color: '#64748b',
        width: 120,
        fontWeight: 'bold',
    },
    value: {
        fontSize: 10,
        color: '#1e293b',
        flex: 1,
    },
    table: {
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        padding: 8,
        borderRadius: 4,
        marginBottom: 5,
    },
    tableHeaderCell: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#475569',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        borderBottomStyle: 'solid',
    },
    tableCell: {
        fontSize: 9,
        color: '#1e293b',
    },
    col1: { width: '25%' },
    col2: { width: '40%' },
    col3: { width: '20%' },
    col4: { width: '15%', textAlign: 'right' },
    totalSection: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#f0fdf4',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#86efac',
        borderStyle: 'solid',
    },
    totalLabel: {
        fontSize: 12,
        color: '#166534',
        marginBottom: 4,
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#15803d',
    },
    footer: {
        marginTop: 30,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#cbd5e1',
        borderTopStyle: 'solid',
    },
    disclaimer: {
        fontSize: 8,
        color: '#64748b',
        fontStyle: 'italic',
        marginBottom: 6,
    },
    timestamp: {
        fontSize: 8,
        color: '#94a3b8',
        textAlign: 'right',
    },
});

interface Commission {
    id: string;
    amount: number;
    paid_at: string;
    sale?: {
        student?: {
            full_name: string;
            email: string;
        };
        pack?: {
            name: string;
        };
    };
}

interface Profile {
    full_name: string;
    role: string;
    payment_details?: string;
}

interface CommissionPayslipProps {
    profile: Profile;
    commissions: Commission[];
    month: string;
}

const CommissionPayslip = ({ profile, commissions, month }: CommissionPayslipProps) => {
    const totalAmount = commissions.reduce((sum, c) => sum + c.amount, 0);

    const formatMonth = (monthKey: string) => {
        const [year, monthNum] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(monthNum) - 1);
        return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    const roleLabels: Record<string, string> = {
        closer: 'Closer',
        coach: 'Coach',
        setter: 'Setter',
        admin: 'Administrador',
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>ECOBOMB</Text>
                    <Text style={styles.subtitle}>Liquidación de Comisiones</Text>
                </View>

                {/* Staff Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Información del Beneficiario</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Nombre:</Text>
                        <Text style={styles.value}>{profile.full_name}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Rol:</Text>
                        <Text style={styles.value}>{roleLabels[profile.role] || profile.role}</Text>
                    </View>
                    {profile.payment_details && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Datos de Pago:</Text>
                            <Text style={styles.value}>{profile.payment_details}</Text>
                        </View>
                    )}
                </View>

                {/* Period */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Período de Liquidación</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Mes:</Text>
                        <Text style={styles.value}>{formatMonth(month)}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Comisiones:</Text>
                        <Text style={styles.value}>{commissions.length} pago{commissions.length !== 1 ? 's' : ''}</Text>
                    </View>
                </View>

                {/* Commission Details Table */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Detalle de Comisiones</Text>
                    <View style={styles.table}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, styles.col1]}>Fecha</Text>
                            <Text style={[styles.tableHeaderCell, styles.col2]}>Alumno</Text>
                            <Text style={[styles.tableHeaderCell, styles.col3]}>Pack</Text>
                            <Text style={[styles.tableHeaderCell, styles.col4]}>Importe</Text>
                        </View>

                        {/* Table Rows */}
                        {commissions.map((commission) => (
                            <View key={commission.id} style={styles.tableRow}>
                                <Text style={[styles.tableCell, styles.col1]}>
                                    {new Date(commission.paid_at).toLocaleDateString('es-ES')}
                                </Text>
                                <Text style={[styles.tableCell, styles.col2]}>
                                    {commission.sale?.student?.full_name || commission.sale?.student?.email || '-'}
                                </Text>
                                <Text style={[styles.tableCell, styles.col3]}>
                                    {commission.sale?.pack?.name || '-'}
                                </Text>
                                <Text style={[styles.tableCell, styles.col4]}>
                                    {commission.amount.toFixed(2)}€
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Total */}
                <View style={styles.totalSection}>
                    <Text style={styles.totalLabel}>Total Liquidado</Text>
                    <Text style={styles.totalAmount}>{totalAmount.toFixed(2)}€</Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.disclaimer}>
                        Este documento es un extracto informativo de comisiones liquidadas. No constituye una factura ni documento fiscal.
                    </Text>
                    <Text style={styles.timestamp}>
                        Generado el {new Date().toLocaleDateString('es-ES')} a las {new Date().toLocaleTimeString('es-ES')}
                    </Text>
                </View>
            </Page>
        </Document>
    );
};

export default CommissionPayslip;
