/**
 * The browser side of passkeys (WebAuthn). The API sends its options as JSON, binary values in
 * base64url (the format of Spring Security); they become ArrayBuffers for navigator.credentials, and
 * the answer goes back the same way. Written out rather than PublicKeyCredential.parse…FromJSON():
 * those are missing from the iPhones of a few years ago.
 */

/** Some JSON of the API: what it gives, and what goes back. */
type Json = Record<string, unknown>;

/** Passkeys can be made and used here: a browser of the last years, on a secure page (https or localhost). */
export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && typeof window.PublicKeyCredential === 'function';
}

export function fromBase64Url(text: string): ArrayBuffer {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function toBase64Url(buffer: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type Descriptor = { id: string; type: string; transports?: string[] };

function descriptors(list: unknown): PublicKeyCredentialDescriptor[] {
  return ((list as Descriptor[] | undefined) ?? []).map((item) => ({
    ...item,
    id: fromBase64Url(item.id),
    type: 'public-key',
    transports: item.transports as AuthenticatorTransport[] | undefined,
  }));
}

/** The options of the API for navigator.credentials.create(). */
export function creationOptions(options: Json): PublicKeyCredentialCreationOptions {
  const user = options['user'] as { id: string; name: string; displayName: string };
  return {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: fromBase64Url(options['challenge'] as string),
    user: { ...user, id: fromBase64Url(user.id) },
    excludeCredentials: descriptors(options['excludeCredentials']),
  };
}

/** The options of the API for navigator.credentials.get(). */
export function requestOptions(options: Json): PublicKeyCredentialRequestOptions {
  return {
    ...(options as unknown as PublicKeyCredentialRequestOptions),
    challenge: fromBase64Url(options['challenge'] as string),
    allowCredentials: descriptors(options['allowCredentials']),
  };
}

/** The passkey just made, for the API, with its name. */
export function newPasskeyJson(credential: PublicKeyCredential, label: string): Json {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    credential: {
      id: credential.id,
      rawId: toBase64Url(credential.rawId),
      response: {
        attestationObject: toBase64Url(response.attestationObject),
        clientDataJSON: toBase64Url(response.clientDataJSON),
        transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
      },
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults(),
      authenticatorAttachment: credential.authenticatorAttachment,
    },
    label,
  };
}

/** The signature of a passkey, for the API. */
export function assertionJson(credential: PublicKeyCredential): Json {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    response: {
      authenticatorData: toBase64Url(response.authenticatorData),
      clientDataJSON: toBase64Url(response.clientDataJSON),
      signature: toBase64Url(response.signature),
      userHandle: response.userHandle ? toBase64Url(response.userHandle) : undefined,
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  };
}

/**
 * A name for a new passkey, from the device: "iPhone", "Mac", "Windows"… The admin can change it.
 * Read from the user agent: only a guess, shown in "Mon compte".
 */
export function deviceLabel(userAgent: string): string {
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'Passkey';
}

/**
 * What went wrong, said to the admin. The browser refuses when the window is closed or the time runs out
 * (NotAllowedError), and when this device already holds a passkey of the account (InvalidStateError).
 */
export function passkeyErrorMessage(error: unknown): string | null {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return null;
  }
  if (name === 'InvalidStateError') {
    return 'Cet appareil a déjà une passkey pour ce compte';
  }
  if (name === 'SecurityError') {
    return "Les passkeys ne sont pas possibles sur cette adresse du site";
  }
  return "La passkey n'a pas pu être utilisée : réessayez";
}
