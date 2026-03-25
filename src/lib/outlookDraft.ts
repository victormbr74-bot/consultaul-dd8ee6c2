import { InteractionRequiredAuthError, PublicClientApplication } from "@azure/msal-browser";

interface OutlookDraftOptions {
  html: string;
  subject: string;
  to?: string[];
}

interface GraphMessageCreateResponse {
  id?: string;
  webLink?: string;
}

const OUTLOOK_CLIENT_ID = String(import.meta.env.VITE_OUTLOOK_CLIENT_ID || "").trim();
const OUTLOOK_TENANT_ID = String(import.meta.env.VITE_OUTLOOK_TENANT_ID || "organizations").trim() || "organizations";
const OUTLOOK_REDIRECT_URI = String(
  import.meta.env.VITE_OUTLOOK_REDIRECT_URI || `${window.location.origin}/outlook-auth.html`,
).trim() || `${window.location.origin}/outlook-auth.html`;
const GRAPH_SCOPES = ["User.Read", "Mail.ReadWrite"];

let msalAppPromise: Promise<PublicClientApplication> | null = null;

const ensureConfigured = () => {
  if (!OUTLOOK_CLIENT_ID) {
    throw new Error("Outlook corporativo nao configurado. Defina VITE_OUTLOOK_CLIENT_ID.");
  }
};

const getMsalApp = async () => {
  ensureConfigured();

  if (!msalAppPromise) {
    msalAppPromise = (async () => {
      const app = new PublicClientApplication({
        auth: {
          clientId: OUTLOOK_CLIENT_ID,
          authority: `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}`,
          redirectUri: OUTLOOK_REDIRECT_URI,
        },
        cache: {
          cacheLocation: "sessionStorage",
        },
      });

      await app.initialize();
      return app;
    })();
  }

  return msalAppPromise;
};

const getActiveAccount = async (app: PublicClientApplication) => {
  const active = app.getActiveAccount();
  if (active) return active;

  const accounts = app.getAllAccounts();
  if (accounts.length) {
    app.setActiveAccount(accounts[0]);
    return accounts[0];
  }

  const loginResult = await app.loginPopup({
    scopes: GRAPH_SCOPES,
    prompt: "select_account",
  });

  if (!loginResult.account) {
    throw new Error("Nao foi possivel autenticar no Outlook corporativo.");
  }

  app.setActiveAccount(loginResult.account);
  return loginResult.account;
};

const acquireGraphToken = async () => {
  const app = await getMsalApp();
  const account = await getActiveAccount(app);

  try {
    const silentResult = await app.acquireTokenSilent({
      account,
      scopes: GRAPH_SCOPES,
    });
    return silentResult.accessToken;
  } catch (error) {
    if (!(error instanceof InteractionRequiredAuthError)) {
      throw error;
    }

    const popupResult = await app.acquireTokenPopup({
      account,
      scopes: GRAPH_SCOPES,
    });
    return popupResult.accessToken;
  }
};

const graphRequest = async <T>(path: string, accessToken: string, init?: RequestInit) => {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph ${response.status}: ${errorText || response.statusText}`);
  }

  return (await response.json()) as T;
};

const normalizeRecipients = (to: string[] = []) =>
  to
    .map((value) => value.trim())
    .filter(Boolean)
    .map((address) => ({
      emailAddress: {
        address,
      },
    }));

const resolveDraftWebLink = async (accessToken: string, draftId: string) => {
  const draft = await graphRequest<GraphMessageCreateResponse>(
    `/me/messages/${encodeURIComponent(draftId)}?$select=id,webLink`,
    accessToken,
  );

  if (!draft.webLink) {
    throw new Error("O Outlook criou o rascunho, mas nao retornou o link para abertura.");
  }

  return draft.webLink;
};

export const isOutlookDraftConfigured = () => Boolean(OUTLOOK_CLIENT_ID);

export const openOutlookHtmlDraft = async ({ subject, html, to = [] }: OutlookDraftOptions) => {
  const draftWindow = window.open("about:blank", "_blank");

  try {
    const accessToken = await acquireGraphToken();
    const created = await graphRequest<GraphMessageCreateResponse>("/me/messages", accessToken, {
      method: "POST",
      body: JSON.stringify({
        subject,
        body: {
          contentType: "html",
          content: html,
        },
        toRecipients: normalizeRecipients(to),
      }),
    });

    if (!created.id) {
      throw new Error("O Outlook nao retornou o identificador do rascunho.");
    }

    const webLink = created.webLink || (await resolveDraftWebLink(accessToken, created.id));

    if (draftWindow) {
      draftWindow.location.href = webLink;
      return;
    }

    window.open(webLink, "_blank");
  } catch (error) {
    draftWindow?.close();
    throw error;
  }
};
