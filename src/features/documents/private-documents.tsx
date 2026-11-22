"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import ui from "@/components/ui/ui.module.css";
import { useCare, useSessionError } from "@/features/care/care-area";
import { CareError, CareLoading, Feedback } from "@/features/care/states";
import { ApiError } from "@/services/api-client";
import { getPatient } from "@/services/care";
import {
  getDocumentDownloadUrl,
  listDocuments,
  uploadClinicalDocument,
  verifyDocumentOcr,
} from "@/services/documents";
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  type ClinicalDocument,
} from "@/types/documents";
import styles from "./documents.module.css";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function DocumentOcrCard({
  doc,
  onVerified,
}: {
  doc: ClinicalDocument;
  onVerified: () => void;
}) {
  const [textDraft, setTextDraft] = useState(doc.extracted_text ?? "");
  const [editing, setEditing] = useState(!doc.is_verified);

  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyDocumentOcr(doc.id, { extracted_text: textDraft }),
    onSuccess: () => {
      setEditing(false);
      onVerified();
    },
  });

  return (
    <article className={styles.docCard}>
      <div className={styles.docTop}>
        <div>
          <h3 className={styles.docTitle}>{doc.title}</h3>
          <span className={styles.docMeta}>
            {doc.file_name} · {formatBytes(doc.size_bytes)} · Enviado em{" "}
            {formatDateTime(doc.created_at)}
          </span>
        </div>

        <div className={styles.badgesRow}>
          {doc.ocr_status === "failed" || doc.ocr_status === "unsupported" ? (
            <span className={styles.badgeFailed}>
              {doc.ocr_status === "unsupported"
                ? "PDF sem camada de texto"
                : "Falha na leitura OCR"}
            </span>
          ) : doc.is_verified ? (
            <span className={styles.badgeVerified}>
              Texto revisado e validado
            </span>
          ) : (
            <span className={styles.badgeUnverified}>
              Aguardando revisão humana
            </span>
          )}
        </div>
      </div>

      {/* Área de Revisão do Texto Extraído pelo OCR */}
      <div className={styles.ocrPanel}>
        <div className={styles.ocrHeader}>
          <h4>Texto extraído (OCR)</h4>
          {doc.is_verified && !editing && (
            <Button
              type="button"
              variant="secondary"
              className={styles.smallBtn}
              onClick={() => setEditing(true)}
            >
              Revisar novamente
            </Button>
          )}
        </div>

        {!doc.is_verified && (
          <p className={styles.ocrNotice}>
            <strong>Atenção:</strong> O texto extraído automaticamente pode
            conter falhas de leitura e não substitui avaliação clínica. Revise e
            corrija o conteúdo abaixo antes de validar.
          </p>
        )}

        {doc.ocr_error && (
          <p className={styles.errorText}>Aviso do OCR: {doc.ocr_error}</p>
        )}

        <Feedback error={verifyMutation.error} />

        <textarea
          className={styles.ocrTextarea}
          value={textDraft}
          disabled={!editing || verifyMutation.isPending}
          placeholder="Nenhum texto extraído automaticamente. Você pode transcrever manualmente as informações relevantes do exame aqui."
          onChange={(e) => setTextDraft(e.target.value)}
        />

        <div className={styles.docActions}>
          <a
            href={getDocumentDownloadUrl(doc.id)}
            target="_blank"
            rel="noopener noreferrer"
            className={[ui.button, ui.secondary, styles.smallBtn].join(" ")}
          >
            Baixar arquivo original
          </a>

          {editing && (
            <Button
              type="button"
              className={styles.smallBtn}
              disabled={verifyMutation.isPending}
              onClick={() => verifyMutation.mutate()}
            >
              {verifyMutation.isPending
                ? "Validando…"
                : "Confirmar revisão e validar texto"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function PrivateDocuments({ patientId }: { patientId?: string }) {
  const { user } = useCare();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  const [notice, setNotice] = useState("");

  const isProfessional = user.role === "PROFESSIONAL";

  const patientQuery = useQuery({
    queryKey: ["care", user.id, "patient", patientId],
    queryFn: ({ signal }) => getPatient(patientId!, signal),
    enabled: isProfessional && !!patientId,
    gcTime: 0,
  });

  const docsQuery = useInfiniteQuery({
    queryKey: ["care", user.id, "documents", patientId ?? "self"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listDocuments({ patientId, cursor: pageParam }, signal),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: !isProfessional || !!patientQuery.data,
    gcTime: 0,
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Selecione um arquivo.");
      return uploadClinicalDocument({
        title,
        file,
        patientId: isProfessional ? patientId : undefined,
      });
    },
    onSuccess: async () => {
      setTitle("");
      setFile(null);
      setValidationError("");
      setNotice(
        "Documento enviado com segurança. Revise o texto extraído antes de validar.",
      );
      await client.invalidateQueries({
        queryKey: ["care", user.id, "documents", patientId ?? "self"],
      });
    },
  });

  useSessionError(
    patientQuery.error || docsQuery.error || uploadMutation.error,
  );

  if (isProfessional && patientQuery.isError) {
    return (
      <CareError
        error={patientQuery.error}
        retry={() => void patientQuery.refetch()}
        fetching={patientQuery.isFetching}
      />
    );
  }

  if (isProfessional && patientQuery.isPending) {
    return <CareLoading title="Confirmando autorização do paciente" />;
  }

  const isEndpointMissing =
    (docsQuery.error instanceof ApiError && docsQuery.error.status === 404) ||
    (uploadMutation.error instanceof ApiError &&
      uploadMutation.error.status === 404);

  const documents = [
    ...new Map(
      (docsQuery.data?.pages.flatMap((p) => p.items) ?? []).map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];

  function handleUpload(e: FormEvent) {
    e.preventDefault();
    setNotice("");
    setValidationError("");

    if (!title.trim()) {
      setValidationError("Informe um título para identificar o documento.");
      return;
    }
    if (!file) {
      setValidationError("Selecione um arquivo PDF ou imagem (JPG, PNG, WEBP).");
      return;
    }
    if (
      !ALLOWED_DOCUMENT_TYPES.includes(
        file.type as (typeof ALLOWED_DOCUMENT_TYPES)[number],
      )
    ) {
      setValidationError(
        "Formato não suportado. Use apenas PDF, JPG, PNG ou WEBP.",
      );
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setValidationError("O arquivo excede o limite máximo de 10 MB.");
      return;
    }

    uploadMutation.mutate();
  }

  return (
    <div className={styles.stack}>
      {isProfessional && patientId && patientQuery.data && (
        <div>
          <Link href={`/professional/patients/${patientId}`}>
            ← Voltar para ficha de {patientQuery.data.full_name}
          </Link>
        </div>
      )}

      <div className={styles.layout}>
        {/* Coluna Esquerda: Envio Seguro */}
        <section className={styles.surface} aria-labelledby="upload-doc-title">
          <div className={styles.surfaceHeader}>
            <div>
              <h2 id="upload-doc-title">Enviar exame ou laudo</h2>
              <p className={styles.subtitle}>
                Armazenamento privado com extração assistida por OCR.
              </p>
            </div>
          </div>

          {isEndpointMissing && (
            <Feedback message="A interface de Documentos Privados e Revisão OCR está pronta e aguardando a ativação da rota /api/v1/documents no back-end." />
          )}

          {!isEndpointMissing && (
            <Feedback error={uploadMutation.error} message={notice} />
          )}

          <form
            className={styles.form}
            noValidate
            aria-busy={uploadMutation.isPending}
            onSubmit={handleUpload}
          >
            <div className={styles.field}>
              <label className={styles.label} htmlFor="doc-title">
                Título do documento
              </label>
              <input
                id="doc-title"
                placeholder="Ex: Ressonância Magnética Coluna Lombar"
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="doc-file">
                Arquivo (PDF, JPG, PNG ou WEBP · até 10 MB)
              </label>
              <div className={styles.dropZone}>
                <input
                  id="doc-file"
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className={styles.fileInput}
                  onChange={(e) => {
                    setValidationError("");
                    setFile(e.target.files?.[0] ?? null);
                  }}
                />
                <p className={styles.hint}>
                  Arquivos são armazenados com chaves aleatórias privadas e
                  acessíveis apenas mediante autorização explícita.
                </p>
              </div>
            </div>

            {validationError && (
              <p className={styles.errorText} role="alert">
                {validationError}
              </p>
            )}

            <Button type="submit" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending
                ? "Enviando e processando OCR…"
                : "Enviar documento"}
            </Button>
          </form>
        </section>

        {/* Coluna Direita: Documentos e Revisão OCR */}
        <section className={styles.surface} aria-labelledby="docs-list-title">
          <div className={styles.surfaceHeader}>
            <div>
              <h2 id="docs-list-title">Documentos armazenados</h2>
              <p className={styles.subtitle}>
                Revise o texto extraído de cada arquivo antes de considerá-lo
                validado.
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={docsQuery.isFetching}
              onClick={() => void docsQuery.refetch()}
            >
              Atualizar
            </Button>
          </div>

          {docsQuery.isPending ? (
            <CareLoading title="Carregando documentos privados" />
          ) : docsQuery.isError && !isEndpointMissing ? (
            <CareError
              error={docsQuery.error}
              retry={() => void docsQuery.refetch()}
              fetching={docsQuery.isFetching}
            />
          ) : documents.length === 0 ? (
            <div className={styles.emptyState}>
              <p>
                Nenhum exame ou laudo enviado ainda. Use o formulário ao lado
                para anexar um arquivo.
              </p>
            </div>
          ) : (
            <div className={styles.docsList}>
              {documents.map((doc) => (
                <DocumentOcrCard
                  key={doc.id}
                  doc={doc}
                  onVerified={() => {
                    setNotice("Texto revisado e marcado como validado.");
                    void client.invalidateQueries({
                      queryKey: [
                        "care",
                        user.id,
                        "documents",
                        patientId ?? "self",
                      ],
                    });
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}