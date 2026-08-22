--
-- PostgreSQL database dump
--

\restrict egNydgbWBOizFIYQf23UhEGcmocTngXgGwBdYyRVfQn4McSugQlI04A2J4b5lr3

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: admin; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA admin;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ads_campaign; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.ads_campaign (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    platforms text[] DEFAULT '{}'::text[] NOT NULL,
    ziel text DEFAULT 'REGISTRATIONS'::text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    daily_budget_cents integer,
    total_budget_cents integer,
    start_date date,
    end_date date,
    targeting jsonb DEFAULT '{}'::jsonb NOT NULL,
    creative_id uuid,
    primaertext text,
    ueberschrift text,
    beschreibung text,
    cta text DEFAULT 'SIGN_UP'::text,
    landing_url text,
    tracking jsonb DEFAULT '{}'::jsonb NOT NULL,
    external_ids jsonb DEFAULT '{}'::jsonb NOT NULL,
    fehler text,
    published_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: ads_creative; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.ads_creative (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    typ text DEFAULT 'IMAGE'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    storage_path text,
    url text,
    thumbnail_url text,
    aspect_ratio text,
    notiz text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: ads_insight; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.ads_insight (
    id bigint NOT NULL,
    campaign_id uuid,
    platform text NOT NULL,
    ad_set_id text,
    ad_id text,
    datum date NOT NULL,
    spend_cents integer DEFAULT 0 NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    reach integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    conversions integer DEFAULT 0 NOT NULL,
    registrations integer DEFAULT 0 NOT NULL,
    applications integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ads_insight_id_seq; Type: SEQUENCE; Schema: admin; Owner: -
--

ALTER TABLE admin.ads_insight ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME admin.ads_insight_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: appointment; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.appointment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    employee_id uuid,
    entity_type text,
    entity_id text,
    location text,
    status text DEFAULT 'PLANNED'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: audit_log; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.audit_log (
    id bigint NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: admin; Owner: -
--

ALTER TABLE admin.audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME admin.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: automation; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.automation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    trigger text NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb NOT NULL,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: automation_run; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.automation_run (
    id bigint NOT NULL,
    automation_id uuid,
    trigger text NOT NULL,
    matched integer DEFAULT 0 NOT NULL,
    actions_done integer DEFAULT 0 NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_run_id_seq; Type: SEQUENCE; Schema: admin; Owner: -
--

ALTER TABLE admin.automation_run ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME admin.automation_run_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bank_account; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.bank_account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    bank_name text,
    iban text,
    bic text,
    provider text DEFAULT 'MANUELL'::text NOT NULL,
    status text DEFAULT 'VORBEREITET'::text NOT NULL,
    balance_cents bigint,
    connected_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: bank_transaction; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.bank_transaction (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    booked_at date,
    amount_cents bigint NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    purpose text,
    counterparty_name text,
    counterparty_iban text,
    matched_invoice_id uuid,
    status text DEFAULT 'UNMATCHED'::text NOT NULL,
    imported_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: benachrichtigung_vorlage; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.benachrichtigung_vorlage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event text NOT NULL,
    name text NOT NULL,
    kategorie text DEFAULT 'Konto'::text NOT NULL,
    titel text NOT NULL,
    betreff text,
    einleitung text,
    schluss text,
    variablen jsonb DEFAULT '[]'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    variante text DEFAULT 'brief'::text NOT NULL,
    hervorhebung text,
    code integer
);


--
-- Name: call_session; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.call_session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id text NOT NULL,
    candidate_name text,
    employee_id uuid,
    task_id uuid,
    fragen jsonb DEFAULT '[]'::jsonb NOT NULL,
    antworten jsonb DEFAULT '{}'::jsonb NOT NULL,
    overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    top_jobs jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'OFFEN'::text NOT NULL,
    notiz text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    ergebnis text
);


--
-- Name: campaign; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.campaign (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    audience jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    scheduled_at timestamp with time zone,
    created_by uuid,
    recipient_count integer DEFAULT 0 NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: candidate; Type: VIEW; Schema: admin; Owner: -
--

CREATE VIEW admin.candidate AS
 SELECT u.id,
    u."firstName",
    u."lastName",
    u.email,
    u.phone,
    COALESCE(((j.pd -> 'profil'::text) ->> 'beruf'::text), (((j.pd -> '2'::text) -> 'profil'::text) ->> 'beruf'::text), ((j.pd -> 'profil'::text) ->> 'bereich'::text), (((j.pd -> '2'::text) -> 'profil'::text) ->> 'bereich'::text)) AS profession,
    NULLIF(split_part(((((j.pd -> '3'::text) -> 'workLocations'::text) -> 0) ->> 'label'::text), ', '::text, 2), ''::text) AS "federalState",
    NULL::integer AS "birthYear",
    NULL::text AS availability,
    NULL::text AS "searchIntent",
    'SUBMITTED'::text AS status,
    COALESCE(u."emailVerified", false) AS verified,
    NULL::timestamp with time zone AS "verifiedAt",
    NULL::timestamp with time zone AS "consentAt",
    u."createdAt",
    u."updatedAt",
    NULL::timestamp with time zone AS "retentionUntil",
    'user'::text AS source
   FROM (public."User" u
     CROSS JOIN LATERAL ( SELECT
                CASE
                    WHEN (u."profileData" IS NULL) THEN '{}'::jsonb
                    ELSE u."profileData"
                END AS pd) j)
  WHERE ((u.role = 'APPLICANT'::public."UserRole") AND (NOT (EXISTS ( SELECT 1
           FROM public."Application" a
          WHERE ((a.status <> 'ERASED'::public."ApplicationStatus") AND (lower(a.email) = lower(u.email)))))))
UNION ALL
 SELECT a.id,
    a."firstName",
    a."lastName",
    a.email,
    a.phone,
    a.profession,
    a."federalState",
    a."birthYear",
    a.availability,
    (a."searchIntent")::text AS "searchIntent",
    (a.status)::text AS status,
    a.verified,
    a."verifiedAt",
    a."consentAt",
    a."createdAt",
    a."updatedAt",
    a."retentionUntil",
    'application'::text AS source
   FROM public."Application" a
  WHERE (a.status <> 'ERASED'::public."ApplicationStatus");


--
-- Name: candidate_meta; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.candidate_meta (
    application_id text NOT NULL,
    status text DEFAULT 'NEU'::text NOT NULL,
    assignee_id uuid,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    archived_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    verfuegbar_bestaetigt_am timestamp with time zone
);


--
-- Name: communication; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.communication (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel text DEFAULT 'EMAIL'::text NOT NULL,
    direction text DEFAULT 'OUTBOUND'::text NOT NULL,
    subject text,
    body text,
    entity_type text,
    entity_id text,
    employee_id uuid,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    event_code integer
);


--
-- Name: company_lead; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.company_lead (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    ansprechpartner text,
    email text,
    phone text,
    ort text,
    website text,
    quelle text,
    status text DEFAULT 'NEU'::text NOT NULL,
    notiz text,
    assignee_id uuid,
    last_contacted_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: company_meta; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.company_meta (
    company_id text NOT NULL,
    status text DEFAULT 'NEU'::text NOT NULL,
    assignee_id uuid,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    archived_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dashboard_config; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.dashboard_config (
    employee_id uuid NOT NULL,
    widgets jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.employee (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    role_id text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    team text,
    avatar_color text DEFAULT '#E8590C'::text NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    must_change_password boolean DEFAULT false NOT NULL,
    totp_secret text,
    totp_enabled boolean DEFAULT false NOT NULL,
    ical_token text,
    username text,
    phone text,
    first_name text,
    last_name text,
    created_by uuid,
    permission_overrides jsonb,
    avatar_url text,
    totp_last_code text,
    totp_last_at timestamp with time zone
);


--
-- Name: entity_tag; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.entity_tag (
    tag_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorite; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.favorite (
    employee_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.invoice (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nummer text,
    placement_id uuid,
    company_id text,
    company_name text,
    base_fee_cents integer DEFAULT 0 NOT NULL,
    commission_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'OFFEN'::text NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    due_at timestamp with time zone,
    paid_at timestamp with time zone,
    reminder_count integer DEFAULT 0 NOT NULL,
    last_reminder_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    art text DEFAULT 'VERMITTLUNG'::text NOT NULL,
    referral_id text,
    recipient_name text,
    recipient_address text,
    positionen jsonb,
    tax_rate integer DEFAULT 0 NOT NULL,
    service_date date,
    annual_salary_cents bigint,
    provision_percent numeric(5,2),
    payout_id uuid
);


--
-- Name: invoice_seq; Type: SEQUENCE; Schema: admin; Owner: -
--

CREATE SEQUENCE admin.invoice_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ki_cache; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.ki_cache (
    cache_key text NOT NULL,
    feature text NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);


--
-- Name: ki_usage; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.ki_usage (
    id bigint NOT NULL,
    feature text NOT NULL,
    model text NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cache_read_tokens integer DEFAULT 0 NOT NULL,
    cache_write_tokens integer DEFAULT 0 NOT NULL,
    ok boolean DEFAULT true NOT NULL,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ki_usage_id_seq; Type: SEQUENCE; Schema: admin; Owner: -
--

ALTER TABLE admin.ki_usage ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME admin.ki_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: login_event; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.login_event (
    id bigint NOT NULL,
    employee_id uuid,
    email text NOT NULL,
    success boolean NOT NULL,
    ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: login_event_id_seq; Type: SEQUENCE; Schema: admin; Owner: -
--

ALTER TABLE admin.login_event ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME admin.login_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: match_suggestion; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.match_suggestion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id text NOT NULL,
    candidate_name text,
    job_posting_id text NOT NULL,
    job_title text,
    company_id text,
    company_name text,
    match_score integer NOT NULL,
    richtung text DEFAULT 'JOB_FUER_KANDIDAT'::text NOT NULL,
    status text DEFAULT 'NEU'::text NOT NULL,
    assignee_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    handled_at timestamp with time zone
);


--
-- Name: mcp_log; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.mcp_log (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tool text NOT NULL,
    art text NOT NULL,
    argumente jsonb,
    ok boolean DEFAULT true NOT NULL,
    info text
);


--
-- Name: mcp_log_id_seq; Type: SEQUENCE; Schema: admin; Owner: -
--

ALTER TABLE admin.mcp_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME admin.mcp_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: merge_log; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.merge_log (
    id bigint NOT NULL,
    entity_type text NOT NULL,
    ziel_id text NOT NULL,
    quelle_id text NOT NULL,
    actor_id uuid,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: merge_log_id_seq; Type: SEQUENCE; Schema: admin; Owner: -
--

ALTER TABLE admin.merge_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME admin.merge_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: note; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.note (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content text NOT NULL,
    category text DEFAULT 'ALLGEMEIN'::text NOT NULL,
    author_id uuid,
    entity_type text,
    entity_id text,
    pinned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: notification; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.notification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    entity_type text,
    entity_id text,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: outbox_email; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.outbox_email (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    to_email text NOT NULL,
    to_name text,
    subject text NOT NULL,
    body text NOT NULL,
    entity_type text,
    entity_id text,
    kind text DEFAULT 'CAMPAIGN'::text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    html text,
    event_code integer,
    created_by uuid,
    attempts integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone,
    claimed_at timestamp with time zone
);


--
-- Name: payout; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.payout (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    art text DEFAULT 'SONSTIGE'::text NOT NULL,
    status text DEFAULT 'OFFEN'::text NOT NULL,
    recipient_name text NOT NULL,
    recipient_kind text,
    recipient_email text,
    amount_cents integer NOT NULL,
    bank_holder text,
    bank_iban text,
    bank_bic text,
    method text DEFAULT 'UEBERWEISUNG'::text NOT NULL,
    entity_type text,
    entity_id text,
    referral_id text,
    placement_id uuid,
    invoice_id uuid,
    email_sent_at timestamp with time zone,
    notiz text,
    due_at timestamp with time zone,
    approved_at timestamp with time zone,
    approved_by uuid,
    paid_at timestamp with time zone,
    paid_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: placement; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.placement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id text,
    candidate_name text,
    company_id text,
    company_name text,
    job_posting_id text,
    job_title text,
    referral_id text,
    employee_id uuid,
    status text DEFAULT 'PLACED'::text NOT NULL,
    placed_at timestamp with time zone DEFAULT now() NOT NULL,
    base_fee_cents integer DEFAULT 4900 NOT NULL,
    commission_cents integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    match_score integer,
    retention_due_at timestamp with time zone,
    retention_paid_at timestamp with time zone
);


--
-- Name: proposal; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.proposal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id text NOT NULL,
    candidate_name text,
    job_posting_id text NOT NULL,
    job_title text,
    company_id text,
    company_name text,
    employee_id uuid,
    match_score integer,
    status text DEFAULT 'VORGESCHLAGEN'::text NOT NULL,
    betrieb_reaktion text,
    offer_message text,
    offer_at timestamp with time zone,
    decline_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: review; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.review (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id text NOT NULL,
    candidate_name text,
    employee_id uuid,
    appointment_id uuid,
    freundlichkeit integer,
    antworten jsonb,
    top_job jsonb,
    notiz text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: role; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.role (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    icon text,
    level integer DEFAULT 20 NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_view; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.saved_view (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    module text NOT NULL,
    name text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.session (
    token_hash text NOT NULL,
    employee_id uuid NOT NULL,
    ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: setting; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.setting (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_state; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.sync_state (
    key text NOT NULL,
    last_run timestamp with time zone,
    cursor jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: tag; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.tag (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#78716c'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.task (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    assignee_id uuid,
    creator_id uuid,
    due_at timestamp with time zone,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    entity_type text,
    entity_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: template; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'EMAIL'::text NOT NULL,
    subject text,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: whatsapp_outbox; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.whatsapp_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid,
    application_id text,
    to_phone text,
    to_name text,
    nachricht text NOT NULL,
    status text DEFAULT 'GEPLANT'::text NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_rule; Type: TABLE; Schema: admin; Owner: -
--

CREATE TABLE admin.whatsapp_rule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    trigger text NOT NULL,
    verzoegerung_stunden integer DEFAULT 0 NOT NULL,
    template_id uuid,
    nachricht text,
    enabled boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: ads_campaign ads_campaign_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ads_campaign
    ADD CONSTRAINT ads_campaign_pkey PRIMARY KEY (id);


--
-- Name: ads_creative ads_creative_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ads_creative
    ADD CONSTRAINT ads_creative_pkey PRIMARY KEY (id);


--
-- Name: ads_insight ads_insight_campaign_id_platform_ad_set_id_ad_id_datum_key; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ads_insight
    ADD CONSTRAINT ads_insight_campaign_id_platform_ad_set_id_ad_id_datum_key UNIQUE (campaign_id, platform, ad_set_id, ad_id, datum);


--
-- Name: ads_insight ads_insight_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ads_insight
    ADD CONSTRAINT ads_insight_pkey PRIMARY KEY (id);


--
-- Name: appointment appointment_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.appointment
    ADD CONSTRAINT appointment_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: automation automation_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.automation
    ADD CONSTRAINT automation_pkey PRIMARY KEY (id);


--
-- Name: automation_run automation_run_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.automation_run
    ADD CONSTRAINT automation_run_pkey PRIMARY KEY (id);


--
-- Name: bank_account bank_account_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.bank_account
    ADD CONSTRAINT bank_account_pkey PRIMARY KEY (id);


--
-- Name: bank_transaction bank_transaction_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.bank_transaction
    ADD CONSTRAINT bank_transaction_pkey PRIMARY KEY (id);


--
-- Name: benachrichtigung_vorlage benachrichtigung_vorlage_event_key; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.benachrichtigung_vorlage
    ADD CONSTRAINT benachrichtigung_vorlage_event_key UNIQUE (event);


--
-- Name: benachrichtigung_vorlage benachrichtigung_vorlage_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.benachrichtigung_vorlage
    ADD CONSTRAINT benachrichtigung_vorlage_pkey PRIMARY KEY (id);


--
-- Name: call_session call_session_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.call_session
    ADD CONSTRAINT call_session_pkey PRIMARY KEY (id);


--
-- Name: campaign campaign_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.campaign
    ADD CONSTRAINT campaign_pkey PRIMARY KEY (id);


--
-- Name: candidate_meta candidate_meta_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.candidate_meta
    ADD CONSTRAINT candidate_meta_pkey PRIMARY KEY (application_id);


--
-- Name: communication communication_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.communication
    ADD CONSTRAINT communication_pkey PRIMARY KEY (id);


--
-- Name: company_lead company_lead_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.company_lead
    ADD CONSTRAINT company_lead_pkey PRIMARY KEY (id);


--
-- Name: company_meta company_meta_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.company_meta
    ADD CONSTRAINT company_meta_pkey PRIMARY KEY (company_id);


--
-- Name: dashboard_config dashboard_config_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.dashboard_config
    ADD CONSTRAINT dashboard_config_pkey PRIMARY KEY (employee_id);


--
-- Name: employee employee_email_key; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.employee
    ADD CONSTRAINT employee_email_key UNIQUE (email);


--
-- Name: employee employee_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.employee
    ADD CONSTRAINT employee_pkey PRIMARY KEY (id);


--
-- Name: entity_tag entity_tag_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.entity_tag
    ADD CONSTRAINT entity_tag_pkey PRIMARY KEY (tag_id, entity_type, entity_id);


--
-- Name: favorite favorite_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.favorite
    ADD CONSTRAINT favorite_pkey PRIMARY KEY (employee_id, entity_type, entity_id);


--
-- Name: invoice invoice_nummer_key; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.invoice
    ADD CONSTRAINT invoice_nummer_key UNIQUE (nummer);


--
-- Name: invoice invoice_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.invoice
    ADD CONSTRAINT invoice_pkey PRIMARY KEY (id);


--
-- Name: ki_cache ki_cache_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ki_cache
    ADD CONSTRAINT ki_cache_pkey PRIMARY KEY (cache_key);


--
-- Name: ki_usage ki_usage_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ki_usage
    ADD CONSTRAINT ki_usage_pkey PRIMARY KEY (id);


--
-- Name: login_event login_event_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.login_event
    ADD CONSTRAINT login_event_pkey PRIMARY KEY (id);


--
-- Name: match_suggestion match_suggestion_application_id_job_posting_id_key; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.match_suggestion
    ADD CONSTRAINT match_suggestion_application_id_job_posting_id_key UNIQUE (application_id, job_posting_id);


--
-- Name: match_suggestion match_suggestion_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.match_suggestion
    ADD CONSTRAINT match_suggestion_pkey PRIMARY KEY (id);


--
-- Name: mcp_log mcp_log_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.mcp_log
    ADD CONSTRAINT mcp_log_pkey PRIMARY KEY (id);


--
-- Name: merge_log merge_log_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.merge_log
    ADD CONSTRAINT merge_log_pkey PRIMARY KEY (id);


--
-- Name: note note_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.note
    ADD CONSTRAINT note_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: outbox_email outbox_email_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.outbox_email
    ADD CONSTRAINT outbox_email_pkey PRIMARY KEY (id);


--
-- Name: payout payout_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.payout
    ADD CONSTRAINT payout_pkey PRIMARY KEY (id);


--
-- Name: placement placement_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.placement
    ADD CONSTRAINT placement_pkey PRIMARY KEY (id);


--
-- Name: proposal proposal_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.proposal
    ADD CONSTRAINT proposal_pkey PRIMARY KEY (id);


--
-- Name: review review_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.review
    ADD CONSTRAINT review_pkey PRIMARY KEY (id);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: saved_view saved_view_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.saved_view
    ADD CONSTRAINT saved_view_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (token_hash);


--
-- Name: setting setting_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.setting
    ADD CONSTRAINT setting_pkey PRIMARY KEY (key);


--
-- Name: sync_state sync_state_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.sync_state
    ADD CONSTRAINT sync_state_pkey PRIMARY KEY (key);


--
-- Name: tag tag_name_key; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.tag
    ADD CONSTRAINT tag_name_key UNIQUE (name);


--
-- Name: tag tag_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);


--
-- Name: task task_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);


--
-- Name: template template_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.template
    ADD CONSTRAINT template_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_outbox whatsapp_outbox_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.whatsapp_outbox
    ADD CONSTRAINT whatsapp_outbox_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_rule whatsapp_rule_pkey; Type: CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.whatsapp_rule
    ADD CONSTRAINT whatsapp_rule_pkey PRIMARY KEY (id);


--
-- Name: ads_campaign_status_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX ads_campaign_status_idx ON admin.ads_campaign USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: ads_insight_datum_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX ads_insight_datum_idx ON admin.ads_insight USING btree (datum);


--
-- Name: appointment_entity_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX appointment_entity_idx ON admin.appointment USING btree (entity_type, entity_id) WHERE (deleted_at IS NULL);


--
-- Name: appointment_time_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX appointment_time_idx ON admin.appointment USING btree (starts_at) WHERE (deleted_at IS NULL);


--
-- Name: audit_log_created_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX audit_log_created_idx ON admin.audit_log USING btree (created_at DESC);


--
-- Name: audit_log_entity_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX audit_log_entity_idx ON admin.audit_log USING btree (entity_type, entity_id);


--
-- Name: bank_tx_account_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX bank_tx_account_idx ON admin.bank_transaction USING btree (account_id);


--
-- Name: bank_tx_status_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX bank_tx_status_idx ON admin.bank_transaction USING btree (status);


--
-- Name: call_session_app_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX call_session_app_idx ON admin.call_session USING btree (application_id) WHERE (deleted_at IS NULL);


--
-- Name: call_session_employee_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX call_session_employee_idx ON admin.call_session USING btree (employee_id) WHERE (deleted_at IS NULL);


--
-- Name: candidate_meta_assignee_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX candidate_meta_assignee_idx ON admin.candidate_meta USING btree (assignee_id) WHERE (assignee_id IS NOT NULL);


--
-- Name: communication_employee_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX communication_employee_idx ON admin.communication USING btree (employee_id) WHERE (deleted_at IS NULL);


--
-- Name: communication_entity_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX communication_entity_idx ON admin.communication USING btree (entity_type, entity_id) WHERE (deleted_at IS NULL);


--
-- Name: company_lead_assignee_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX company_lead_assignee_idx ON admin.company_lead USING btree (assignee_id) WHERE ((deleted_at IS NULL) AND (assignee_id IS NOT NULL));


--
-- Name: company_lead_status_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX company_lead_status_idx ON admin.company_lead USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: company_meta_assignee_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX company_meta_assignee_idx ON admin.company_meta USING btree (assignee_id) WHERE (assignee_id IS NOT NULL);


--
-- Name: employee_username_uidx; Type: INDEX; Schema: admin; Owner: -
--

CREATE UNIQUE INDEX employee_username_uidx ON admin.employee USING btree (lower(username)) WHERE ((deleted_at IS NULL) AND (username IS NOT NULL));


--
-- Name: entity_tag_entity_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX entity_tag_entity_idx ON admin.entity_tag USING btree (entity_type, entity_id);


--
-- Name: invoice_payout_uidx; Type: INDEX; Schema: admin; Owner: -
--

CREATE UNIQUE INDEX invoice_payout_uidx ON admin.invoice USING btree (payout_id) WHERE ((payout_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: invoice_status_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX invoice_status_idx ON admin.invoice USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: ki_usage_feature_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX ki_usage_feature_idx ON admin.ki_usage USING btree (feature, created_at DESC);


--
-- Name: login_event_created_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX login_event_created_idx ON admin.login_event USING btree (created_at DESC);


--
-- Name: match_sugg_status_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX match_sugg_status_idx ON admin.match_suggestion USING btree (status, match_score DESC);


--
-- Name: mcp_log_art_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX mcp_log_art_idx ON admin.mcp_log USING btree (art, created_at DESC);


--
-- Name: mcp_log_created_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX mcp_log_created_idx ON admin.mcp_log USING btree (created_at DESC);


--
-- Name: note_content_trgm; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX note_content_trgm ON admin.note USING gin (content public.gin_trgm_ops);


--
-- Name: note_entity_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX note_entity_idx ON admin.note USING btree (entity_type, entity_id) WHERE (deleted_at IS NULL);


--
-- Name: notification_employee_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX notification_employee_idx ON admin.notification USING btree (employee_id, read_at);


--
-- Name: outbox_campaign_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX outbox_campaign_idx ON admin.outbox_email USING btree (campaign_id);


--
-- Name: outbox_pickup_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX outbox_pickup_idx ON admin.outbox_email USING btree (status, next_retry_at) WHERE (status = ANY (ARRAY['PENDING'::text, 'SENDING'::text]));


--
-- Name: outbox_status_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX outbox_status_idx ON admin.outbox_email USING btree (status, created_at);


--
-- Name: payout_art_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX payout_art_idx ON admin.payout USING btree (art) WHERE (deleted_at IS NULL);


--
-- Name: payout_source_uidx; Type: INDEX; Schema: admin; Owner: -
--

CREATE UNIQUE INDEX payout_source_uidx ON admin.payout USING btree (art, entity_type, entity_id) WHERE (deleted_at IS NULL);


--
-- Name: payout_status_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX payout_status_idx ON admin.payout USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: proposal_app_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX proposal_app_idx ON admin.proposal USING btree (application_id) WHERE (deleted_at IS NULL);


--
-- Name: proposal_job_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX proposal_job_idx ON admin.proposal USING btree (job_posting_id) WHERE (deleted_at IS NULL);


--
-- Name: proposal_status_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX proposal_status_idx ON admin.proposal USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: review_application_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX review_application_idx ON admin.review USING btree (application_id) WHERE (deleted_at IS NULL);


--
-- Name: session_employee_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX session_employee_idx ON admin.session USING btree (employee_id);


--
-- Name: task_assignee_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX task_assignee_idx ON admin.task USING btree (assignee_id) WHERE (deleted_at IS NULL);


--
-- Name: task_due_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX task_due_idx ON admin.task USING btree (due_at) WHERE (deleted_at IS NULL);


--
-- Name: task_entity_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX task_entity_idx ON admin.task USING btree (entity_type, entity_id) WHERE (deleted_at IS NULL);


--
-- Name: wa_outbox_status_idx; Type: INDEX; Schema: admin; Owner: -
--

CREATE INDEX wa_outbox_status_idx ON admin.whatsapp_outbox USING btree (status, scheduled_at);


--
-- Name: ads_campaign ads_campaign_created_by_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ads_campaign
    ADD CONSTRAINT ads_campaign_created_by_fkey FOREIGN KEY (created_by) REFERENCES admin.employee(id);


--
-- Name: ads_campaign ads_campaign_creative_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ads_campaign
    ADD CONSTRAINT ads_campaign_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES admin.ads_creative(id);


--
-- Name: ads_creative ads_creative_created_by_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ads_creative
    ADD CONSTRAINT ads_creative_created_by_fkey FOREIGN KEY (created_by) REFERENCES admin.employee(id);


--
-- Name: ads_insight ads_insight_campaign_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ads_insight
    ADD CONSTRAINT ads_insight_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES admin.ads_campaign(id);


--
-- Name: appointment appointment_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.appointment
    ADD CONSTRAINT appointment_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES admin.employee(id);


--
-- Name: automation_run automation_run_automation_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.automation_run
    ADD CONSTRAINT automation_run_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES admin.automation(id);


--
-- Name: bank_account bank_account_created_by_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.bank_account
    ADD CONSTRAINT bank_account_created_by_fkey FOREIGN KEY (created_by) REFERENCES admin.employee(id);


--
-- Name: bank_transaction bank_transaction_account_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.bank_transaction
    ADD CONSTRAINT bank_transaction_account_id_fkey FOREIGN KEY (account_id) REFERENCES admin.bank_account(id);


--
-- Name: bank_transaction bank_transaction_matched_invoice_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.bank_transaction
    ADD CONSTRAINT bank_transaction_matched_invoice_id_fkey FOREIGN KEY (matched_invoice_id) REFERENCES admin.invoice(id);


--
-- Name: benachrichtigung_vorlage benachrichtigung_vorlage_updated_by_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.benachrichtigung_vorlage
    ADD CONSTRAINT benachrichtigung_vorlage_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES admin.employee(id);


--
-- Name: call_session call_session_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.call_session
    ADD CONSTRAINT call_session_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: call_session call_session_task_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.call_session
    ADD CONSTRAINT call_session_task_id_fkey FOREIGN KEY (task_id) REFERENCES admin.task(id);


--
-- Name: campaign campaign_created_by_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.campaign
    ADD CONSTRAINT campaign_created_by_fkey FOREIGN KEY (created_by) REFERENCES admin.employee(id);


--
-- Name: candidate_meta candidate_meta_assignee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.candidate_meta
    ADD CONSTRAINT candidate_meta_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES admin.employee(id);


--
-- Name: communication communication_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.communication
    ADD CONSTRAINT communication_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: company_lead company_lead_assignee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.company_lead
    ADD CONSTRAINT company_lead_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES admin.employee(id);


--
-- Name: company_lead company_lead_created_by_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.company_lead
    ADD CONSTRAINT company_lead_created_by_fkey FOREIGN KEY (created_by) REFERENCES admin.employee(id);


--
-- Name: company_meta company_meta_assignee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.company_meta
    ADD CONSTRAINT company_meta_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES admin.employee(id);


--
-- Name: dashboard_config dashboard_config_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.dashboard_config
    ADD CONSTRAINT dashboard_config_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: employee employee_role_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.employee
    ADD CONSTRAINT employee_role_id_fkey FOREIGN KEY (role_id) REFERENCES admin.role(id);


--
-- Name: entity_tag entity_tag_tag_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.entity_tag
    ADD CONSTRAINT entity_tag_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES admin.tag(id) ON DELETE CASCADE;


--
-- Name: favorite favorite_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.favorite
    ADD CONSTRAINT favorite_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: invoice invoice_created_by_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.invoice
    ADD CONSTRAINT invoice_created_by_fkey FOREIGN KEY (created_by) REFERENCES admin.employee(id);


--
-- Name: invoice invoice_placement_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.invoice
    ADD CONSTRAINT invoice_placement_id_fkey FOREIGN KEY (placement_id) REFERENCES admin.placement(id);


--
-- Name: ki_usage ki_usage_actor_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.ki_usage
    ADD CONSTRAINT ki_usage_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES admin.employee(id);


--
-- Name: login_event login_event_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.login_event
    ADD CONSTRAINT login_event_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: match_suggestion match_suggestion_assignee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.match_suggestion
    ADD CONSTRAINT match_suggestion_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES admin.employee(id);


--
-- Name: merge_log merge_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.merge_log
    ADD CONSTRAINT merge_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES admin.employee(id);


--
-- Name: note note_author_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.note
    ADD CONSTRAINT note_author_id_fkey FOREIGN KEY (author_id) REFERENCES admin.employee(id);


--
-- Name: notification notification_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.notification
    ADD CONSTRAINT notification_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: outbox_email outbox_email_campaign_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.outbox_email
    ADD CONSTRAINT outbox_email_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES admin.campaign(id);


--
-- Name: payout payout_invoice_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.payout
    ADD CONSTRAINT payout_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES admin.invoice(id);


--
-- Name: placement placement_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.placement
    ADD CONSTRAINT placement_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: proposal proposal_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.proposal
    ADD CONSTRAINT proposal_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: review review_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.review
    ADD CONSTRAINT review_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: saved_view saved_view_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.saved_view
    ADD CONSTRAINT saved_view_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: session session_employee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.session
    ADD CONSTRAINT session_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES admin.employee(id);


--
-- Name: task task_assignee_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.task
    ADD CONSTRAINT task_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES admin.employee(id);


--
-- Name: task task_creator_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.task
    ADD CONSTRAINT task_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES admin.employee(id);


--
-- Name: whatsapp_outbox whatsapp_outbox_rule_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.whatsapp_outbox
    ADD CONSTRAINT whatsapp_outbox_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES admin.whatsapp_rule(id);


--
-- Name: whatsapp_rule whatsapp_rule_created_by_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.whatsapp_rule
    ADD CONSTRAINT whatsapp_rule_created_by_fkey FOREIGN KEY (created_by) REFERENCES admin.employee(id);


--
-- Name: whatsapp_rule whatsapp_rule_template_id_fkey; Type: FK CONSTRAINT; Schema: admin; Owner: -
--

ALTER TABLE ONLY admin.whatsapp_rule
    ADD CONSTRAINT whatsapp_rule_template_id_fkey FOREIGN KEY (template_id) REFERENCES admin.template(id);


--
-- PostgreSQL database dump complete
--

\unrestrict egNydgbWBOizFIYQf23UhEGcmocTngXgGwBdYyRVfQn4McSugQlI04A2J4b5lr3

