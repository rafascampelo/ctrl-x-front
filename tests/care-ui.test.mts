import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ProfileFacts,
  ProfileEditor,
  ProfilePage,
} from "../src/features/care/profile.tsx";
import { CareArea } from "../src/features/care/care-area.tsx";
import {
  CareError,
  CareLoading,
  errorMessage,
} from "../src/features/care/states.tsx";
import {
  RelationshipsPage,
  RequestLinkForm,
  LinkStatus,
} from "../src/features/care/relationships.tsx";
import { ConfirmEndLink } from "../src/features/care/confirm-end-link.tsx";
import { ApiError } from "../src/services/api-client.ts";
import type { Profile, CareLink } from "../src/types/care.ts";

const patient = {
  id: "10000000-0000-4000-8000-000000000001",
  user_id: "20000000-0000-4000-8000-000000000001",
  full_name: "Paciente sintético",
  role: "PATIENT" as const,
};
const professional = {
  ...patient,
  id: "10000000-0000-4000-8000-000000000002",
  user_id: "20000000-0000-4000-8000-000000000002",
  role: "PROFESSIONAL" as const,
  crefito_region: 3,
  crefito_number: "12345-F",
  verification_status: "unverified" as const,
};
const pending: CareLink = {
  id: "30000000-0000-4000-8000-000000000001",
  patient_id: patient.id,
  professional_id: professional.id,
  status: "pending",
  created_at: "2026-11-15T12:00:00Z",
  accepted_at: null,
  revoked_at: null,
  closed_at: null,
};

function renderArea(
  profile: Profile,
  children: ReactNode,
  links: CareLink[] = [],
  expectedRole = profile.role,
  profileError?: Error,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const user = {
    id: profile.user_id,
    role: profile.role,
    email: "synthetic@example.test",
  };
  client.setQueryData(["care-session"], user);
  client.setQueryData(["care", user.id, "profile"], profile);
  client.setQueryDefaults(["care", user.id, "links"], { staleTime: Infinity });
  client.setQueryData(["care", user.id, "links"], links);
  if (profileError) {
    client.getQueryCache().find({ queryKey: ["care", user.id, "profile"] })?.setState({ status: "error", error: profileError, fetchStatus: "idle" });
  }
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        CareArea,
        { role: expectedRole, title: "Meu perfil", description: "Seu cuidado" },
        children,
      ),
    ),
  );
  client.clear();
  return html;
}

test("background profile failures preserve the editor while authorization failures hide it", () => {
  const offline = renderArea(patient, createElement(ProfilePage), [], "PATIENT", new TypeError("offline"));
  assert.match(offline, /name="full_name"/);
  assert.match(offline, /Atualizar perfil/);
  const forbidden = renderArea(patient, createElement(ProfilePage), [], "PATIENT", new ApiError(403));
  assert.doesNotMatch(forbidden, /name="full_name"/);
  assert.match(forbidden, /Acesso não autorizado/);
});

test("patient and physiotherapist profile identification render only available data", () => {
  const html = renderToStaticMarkup(
    createElement(ProfileFacts, {
      profile: patient,
      email: "synthetic@example.test",
    }),
  );
  assert.match(html, /synthetic@example.test/);
  assert.match(html, /Paciente/);
  assert.doesNotMatch(html, /CREFITO/);
  const professionalHtml = renderToStaticMarkup(
    createElement(ProfileFacts, {
      profile: professional,
      email: "synthetic@example.test",
    }),
  );
  assert.match(professionalHtml, /CREFITO-3 · 12345-F/);
  assert.match(professionalHtml, new RegExp(professional.id));
});

test("profile forms render accessible name and CREFITO fields without profession selector", () => {
  const html = renderArea(
    professional,
    createElement(ProfileEditor, { profile: professional }),
  );
  assert.match(html, /name="full_name"/);
  assert.match(html, /Número do CREFITO/);
  assert.match(html, /name="crefito_number"/);
  assert.doesNotMatch(html, /<select|name="verification_status"|name="email"/);
  const patientHtml = renderArea(
    patient,
    createElement(ProfileEditor, { profile: patient }),
  );
  assert.doesNotMatch(patientHtml, /name="crefito/);
});

test("role mismatch blocks private children", () => {
  const html = renderArea(
    patient,
    createElement("div", null, "PRIVATE_CONTENT"),
    [],
    "PROFESSIONAL",
  );
  assert.match(html, /Acesso não autorizado/);
  assert.doesNotMatch(html, /PRIVATE_CONTENT/);
});

test("empty and pending relationship views offer appropriate actions", () => {
  const empty = renderArea(patient, createElement(RelationshipsPage));
  assert.match(empty, /Você ainda não tem um vínculo ativo/);
  assert.match(empty, /Solicitar vínculo/);
  assert.match(empty, /Nenhuma solicitação pendente/);
  const html = renderArea(patient, createElement(RelationshipsPage), [pending]);
  assert.match(html, /Solicitação pendente/);
  assert.match(html, /Cancelar solicitação/);
  assert.doesNotMatch(html, /Aceitar solicitação/);
});

test("active relationship hides new requests and offers confirmed termination", () => {
  const html = renderArea(patient, createElement(RelationshipsPage), [
    { ...pending, status: "active" },
  ]);
  assert.match(html, /Vínculo ativo/);
  assert.match(html, /Solicitação aceita/);
  assert.match(html, /Encerrar vínculo/);
  assert.doesNotMatch(html, /Solicitar vínculo/);
  const dialog = renderToStaticMarkup(
    createElement(ConfirmEndLink, {
      pending: false,
      error: null,
      onConfirm() {},
      onCancel() {},
    }),
  );
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /Confirmar encerramento/);
  assert.match(dialog, /Manter vínculo/);
});

test("professionals with declared registration can accept or reject pending requests", () => {
  const html = renderArea(professional, createElement(RelationshipsPage), [
    pending,
  ]);
  assert.doesNotMatch(html, /Verificação profissional necessária/);
  assert.match(html, />Aceitar solicitação<\/button>/);
  assert.doesNotMatch(html, /disabled[^>]*>Aceitar solicitação/);
  assert.match(html, />Recusar<\/button>/);
  assert.doesNotMatch(html, /Ver identificação/);
});

test("rejected, cancelled and revoked states retain backend distinctions", () => {
  for (const [status, label] of [
    ["rejected", "Solicitação recusada"],
    ["cancelled", "Solicitação cancelada"],
    ["revoked", "Vínculo encerrado"],
  ] as const) {
    assert.match(
      renderToStaticMarkup(createElement(LinkStatus, { status })),
      new RegExp(label),
    );
  }
});

test("loading, expired sessions and HTTP failures have accessible feedback", () => {
  assert.match(
    renderToStaticMarkup(createElement(CareLoading)),
    /role="status" aria-busy="true"/,
  );
  const expired = renderToStaticMarkup(
    createElement(CareError, { error: new ApiError(401) }),
  );
  assert.match(expired, /role="alert"/);
  assert.match(expired, /login\?expired=1/);
  for (const status of [403, 404, 409, 422])
    assert.notEqual(
      errorMessage(new ApiError(status)),
      errorMessage(new TypeError("offline")),
    );
  const form = renderToStaticMarkup(
    createElement(RequestLinkForm, {
      disabled: true,
      pending: true,
      onSubmit: async () => false,
    }),
  );
  assert.match(form, /aria-busy="true"/);
  assert.match(form, /disabled=""/);
});
