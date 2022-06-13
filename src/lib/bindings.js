const devDO = function (url, secret) {
  // development connector for Durable Objects
  // NB this will only work if the export default request handler for your durable object
  // uses the header structure to reference the object id.
  // ie if you have a line like:
  //    const id = env.DOCRYPT.idFromName(name);
  // then that name variable should come from request header called idFromName eg:
  //    const name = request.headers.get(idFromName)
  // this isolates the id from the url structure which should allow this to work in pretty much all cases.

  const newUniqueId = function (options = {}) {
    return { newUniqueId: true };
  };

  const idFromName = function (name) {
    return { idFromName: name };
  };

  const idFromString = function (hexId) {
    return { idFromString: hexId };
  };

  const get = function (idStruct) {
    const alarm = function () {
      throw "Sorry, haven't figured out the best way to implement alarm yet";
    };

    const myFetch = function (resource, init = {}) {
      let request;
      if (typeof resource === "string") {
        init.headers = init.headers || {};
        init.headers = { ...init.headers, ...idStruct };
        init.headers["Access-Key"] = secret;
        request = new Request(`${url}${resource}`, init);
      } else {
        //NB this wont work we need to create a new request
        request = resource;
      }
      return fetch(request);
    };

    return {
      alarm,
      fetch: myFetch,
    };
  };

  return {
    newUniqueId,
    idFromName,
    idFromString,
    get,
  };
};

const devKV = function (url, secret) {
  const get = async function (key) {
    const response = await fetch(`${url}/${encodeURIComponent(key)}`, {
      headers: { "Access-Key": secret },
    });
    const json = await response.json();
    return json;
  };

  const put = async function (key, value) {
    const response = await fetch(`${url}/${encodeURIComponent(key)}`, {
      headers: { "Access-Key": secret },
      method: "POST",
      body: JSON.stringify(value),
    });
    return await response.json();
  };

  const list = async function ({ prefix } = {}) {
    const response = await fetch(
      `${url}/?prefix=${prefix ? encodeURIComponent(prefix) : ""}`,
      { headers: { "Access-Key": secret } }
    );
    return await response.json();
  };

  const del = async function (key) {
    const response = await fetch(`${url}/${encodeURIComponent(key)}`, {
      headers: { "Access-Key": secret },
      method: "DELETE",
    });
    return await response.json();
  };

  return {
    get,
    put,
    list,
    delete: del,
  };
};

let binds = null;

export const bindTo = function (platform, ...names) {
  binds = {};
  if (platform && platform.env) {
    names.forEach((n) => {
      if (n === "WAITUNTIL") {
        // have to do this to avoid illegal invocation error
         binds.WAITUNTIL = (promise) => platform.context.waitUntil(promise);
      } else if (!binds[n]) {
        binds[n] = platform.env[n];
      } else {
        throw `No binding matching ${n} was found.`;
      }
    });
  }  else if (import.meta && import.meta.env) {

    // for local development we expect VITE_DEV_<name> env var which contains url of endpoint
    // key value binds are expected to start with KV (or just KV for single store)
    // or DO for durable objects.
    // And this names must match production bindings - eg dev env var VITE_DEV_DOCRYPT = DOCRYPT binding on production
    // and VITE_DEV_SECRET which has secret for all dev services.
    const secret = import.meta.env.VITE_SECRET;

    names.forEach((name) => {
      if (!binds[name]) {
        const envVarName = `VITE_${name}`;
        if (name.startsWith("KV")) {
          binds[name] = devKV(import.meta.env[envVarName], secret);
        } else if (name.startsWith("DO")) {
          binds[name] = devDO(import.meta.env[envVarName], secret);
        } else if (name === "WAITUNTIL") {
          binds.WAITUNTIL = async (promise) => {return await promise}; // just an empty function for
        } else {
          binds[name] = import.meta.env[envVarName];
          if (!binds[name]) {
            binds[name] = process.env[name];
          }
        }
      }
    });

  }else {
    if (Object.keys(binds).length < 1) {
      throw "No initial binding specificed or platform or import meta env was missing."; // using import dot meta dot env generates a build error
    }
  }
  return binds;
};

export const bindings = function () {
  if (!binds)
    throw "You must call usedBindings with the names of the variables you are going to need before calling bindings";
  return binds;
};
