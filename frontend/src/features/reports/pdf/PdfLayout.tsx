import { Image, Text, View } from "@react-pdf/renderer";
import { fieldTechLogoUrl } from "../../../assets";
import { C, DOC_CODE, styles } from "./theme";

/** Peças de layout comuns a todos os relatórios em PDF — cabeçalho de marca,
 *  rodapé paginado, bloco de assinaturas, cartão de KPI e tabela genérica.
 *  Cada relatório monta sua página compondo essas peças; nenhum PDF deve
 *  redefinir Brand/Footer/tabela por conta própria. */

export function Brand({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View>
      <View style={styles.brandBar}>
        <Image src={fieldTechLogoUrl} style={styles.brandLogo} />
        <View style={styles.brandText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.brandDoc}>{DOC_CODE}</Text>
      </View>
      <View style={styles.rule} />
    </View>
  );
}

export function Footer({ label }: { label: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Field Technology — {label}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

export function SignatureBlock({ roles = ["Gestor", "RH"] }: { roles?: string[] }) {
  return (
    <View style={styles.signRow} wrap={false}>
      {roles.map((role) => (
        <View key={role} style={styles.signCell}>
          <View style={styles.signLine} />
          <Text style={styles.signRole}>{role}</Text>
          <Text style={styles.signHint}>Assinatura e data</Text>
        </View>
      ))}
    </View>
  );
}

export function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color: color ?? C.dark }]}>{value}</Text>
    </View>
  );
}

export interface Col { label: string; width: number; align?: "left" | "right" | "center" }

export function TableHead({ cols }: { cols: Col[] }) {
  return (
    <View style={styles.tHead}>
      {cols.map((c, i) => (
        <Text key={i} style={[styles.tHeadCell, { width: c.width, textAlign: c.align ?? "left" }]}>{c.label}</Text>
      ))}
    </View>
  );
}

export function Row({ cols, cells, bg, bold }: { cols: Col[]; cells: string[]; bg?: string; bold?: boolean }) {
  const base = bold ? styles.tTotal : styles.tRow;
  const cellStyle = bold ? styles.tTotalCell : styles.tCell;
  return (
    <View style={[base, bg ? { backgroundColor: bg } : {}]} wrap={false}>
      {cells.map((v, i) => (
        <Text key={i} style={[cellStyle, { width: cols[i].width, textAlign: cols[i].align ?? "left" }]}>{v}</Text>
      ))}
    </View>
  );
}
