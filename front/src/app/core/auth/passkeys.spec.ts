import {
  assertionJson,
  creationOptions,
  deviceLabel,
  fromBase64Url,
  newPasskeyJson,
  passkeyErrorMessage,
  requestOptions,
  toBase64Url,
} from './passkeys';

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

describe('passkeys', () => {
  it('reads and writes base64url both ways, without padding', () => {
    const buffer = bytes(251, 255, 0, 1, 2);

    expect(toBase64Url(buffer)).toBe('-_8AAQI');
    expect(new Uint8Array(fromBase64Url('-_8AAQI'))).toEqual(new Uint8Array(buffer));
  });

  it('turns the creation options of the API into those of the browser', () => {
    const options = creationOptions({
      challenge: 'AQID',
      rp: { id: 'les-creations-de-yona.fr', name: 'Les créations de Yona' },
      user: { id: 'BAUG', name: 'yona@example.fr', displayName: 'Yona' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      excludeCredentials: [{ id: 'BwgJ', type: 'public-key', transports: ['internal'] }],
    });

    expect(new Uint8Array(options.challenge as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(options.user.id as ArrayBuffer)).toEqual(new Uint8Array([4, 5, 6]));
    expect(options.user.name).toBe('yona@example.fr');
    expect(new Uint8Array(options.excludeCredentials![0]!.id as ArrayBuffer)).toEqual(new Uint8Array([7, 8, 9]));
    expect(options.rp.id).toBe('les-creations-de-yona.fr');
  });

  it('asks for any passkey of the site when the API names none', () => {
    const options = requestOptions({ challenge: 'AQID', rpId: 'localhost' });

    expect(options.allowCredentials).toEqual([]);
    expect(options.rpId).toBe('localhost');
  });

  it('sends the passkey made, with its name, as the API reads it', () => {
    const credential = {
      id: 'Cgs',
      rawId: bytes(10, 11),
      type: 'public-key',
      authenticatorAttachment: 'platform',
      getClientExtensionResults: () => ({ credProps: { rk: true } }),
      response: { attestationObject: bytes(1), clientDataJSON: bytes(2), getTransports: () => ['internal', 'hybrid'] },
    } as unknown as PublicKeyCredential;

    expect(newPasskeyJson(credential, 'iPhone')).toEqual({
      credential: {
        id: 'Cgs',
        rawId: 'Cgs',
        response: { attestationObject: 'AQ', clientDataJSON: 'Ag', transports: ['internal', 'hybrid'] },
        type: 'public-key',
        clientExtensionResults: { credProps: { rk: true } },
        authenticatorAttachment: 'platform',
      },
      label: 'iPhone',
    });
  });

  it('sends the signature of a passkey with the handle of its account', () => {
    const credential = {
      id: 'Cgs',
      rawId: bytes(10, 11),
      type: 'public-key',
      authenticatorAttachment: null,
      getClientExtensionResults: () => ({}),
      response: { authenticatorData: bytes(1), clientDataJSON: bytes(2), signature: bytes(3), userHandle: bytes(4) },
    } as unknown as PublicKeyCredential;

    expect(assertionJson(credential)['response']).toEqual({ authenticatorData: 'AQ', clientDataJSON: 'Ag', signature: 'Aw', userHandle: 'BA' });
  });

  it('names a passkey after the device', () => {
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)')).toBe('iPhone');
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 16; Pixel 9)')).toBe('Android');
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)')).toBe('Mac');
  });

  it('says nothing when the window is closed, and why otherwise', () => {
    expect(passkeyErrorMessage(new DOMException('closed', 'NotAllowedError'))).toBeNull();
    expect(passkeyErrorMessage(new DOMException('again', 'InvalidStateError'))).toBe('Cet appareil a déjà une passkey pour ce compte');
    expect(passkeyErrorMessage(new Error('?'))).toBe("La passkey n'a pas pu être utilisée : réessayez");
  });
});
