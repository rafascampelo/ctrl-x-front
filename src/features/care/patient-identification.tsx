"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import ui from "@/components/ui/ui.module.css";
import { getPatient } from "@/services/care";
import { useCare, useSessionError } from "./care-area";
import { CareError, CareLoading } from "./states";
import styles from "./care.module.css";

export function PatientIdentification({ patientId }: { patientId: string }) {
  const { user } = useCare();
  const query = useQuery({
    queryKey: ["care", user.id, "patient", patientId],
    queryFn: ({ signal }) => getPatient(patientId, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  useSessionError(query.error);

  if (query.isError)
    return (
      <CareError
        error={query.error}
        retry={() => void query.refetch()}
        fetching={query.isFetching}
      />
    );
  if (query.isPending)
    return <CareLoading title="Confirmando acesso ao paciente" />;

  return (
    <div className={styles.stack}>
      <section className={styles.surface}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{query.data.full_name}</h2>
            <p className={styles.muted}>
              Identificação autorizada para acompanhamento individual no Ctrl X.
            </p>
          </div>
          <span className={styles.status}>Vínculo ativo</span>
        </div>

        <dl className={styles.facts}>
          <dt>Código do paciente</dt>
          <dd>
            <code className={styles.code}>{query.data.id}</code>
          </dd>
        </dl>

        <div className={styles.actions} style={{ marginTop: "1.5rem" }}>
          <Link
            href={`/professional/patients/${patientId}/records`}
            className={ui.button}
          >
            Prontuário clínico
          </Link>
          <Link
            href={`/professional/patients/${patientId}/prescriptions`}
            className={[ui.button, ui.secondary].join(" ")}
          >
            Prescrever exercícios
          </Link>
          <Link
            href={`/professional/patients/${patientId}/documents`}
            className={[ui.button, ui.secondary].join(" ")}
          >
            Documentos e exames
          </Link>
        </div>
      </section>

      <div>
        <Link href="/professional/patients">← Voltar para meus pacientes</Link>
      </div>
    </div>
  );
}