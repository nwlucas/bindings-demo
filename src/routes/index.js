import { bindings } from "$lib/bindings";

export async function get({ request }) {
    const { SPECIAL_ENV_VAR, KV, DOCRYPT } = bindings();

    const keys = await KV.list()

    const id = DOCRYPT.idFromName('1');
    const obj = DOCRYPT.get(id);
    const resp = await obj.fetch('/', {
        issuer: 'dummy'
    })
    const publicKey = await resp.text();

    return {
        status: 200,
        body: {
            publicKey,
            envVar: SPECIAL_ENV_VAR,
            kvList: keys
        },
    };

}