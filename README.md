# Vite development bindings for Cloudflare pages deployed SvelteKit
Developing locally for a cloudflare pages deployed sveltekit app is currently a bit of a pain.
We want the goodness of Vite HMR etc while still being able to use the same KV stores and durable objects in development and production.
One way to achieve this is to create worker mirrors for development then stub out the calls so that from a code perspective you're using the same calls


## $lib/bindings.js
All the magic happens in the bindings.js file which has an interface of two calls - bindTo and bindings.

### bindTo
bindTo defines the platform variables you want to access and will create development stubs for KV stores and durable objects.
Usually you would call this as the first line in your hooks.js file passing in the cloudflare platform object (which will be empty when running under Vite) eg:
````
import { bindTo } from "$lib/bindings";
bindTo(event.platform, 'KV','NODE_ENV','DOCRYPT',"WAITUNTIL")
````
This function also returns bindings so you can reference them if you need access in the hooks.js file eg:
````
const {KV, NODE_ENV} = bindTo(event.platform, 'KV','NODE_ENV','DOCRYPT',"WAITUNTIL")
````
see src/hooks.js for an example

### bindings
Once you have established bindings in your hooks js file you can access them in any other (server side) code using the bindings call eg:
````
import { bindings } from "$lib/bindings";
const {KV, NODE_ENV} = bindings();
\\ or
const binds = bindings();
`````
see src/routes/index.js for an example

## Binding to different types
bindings.js tries to normalize some of the madness that happens between working with import.meta.env in development with Vite and platform.env in production with Cloudflare

*as an aside how was it decided to import.etc for Vite's environment names.  As a reserved word import seems to cause all sorts of problems in javascript I've even had weird errors trying to write 'import.meta.env' in a string context.  If you run into something weird try changing it to import dot meta dot env unless you actually need it in code.*

You can bind to different types that might turn up in the enviroment here's how...

### Environment variables
Environment variables can be saved **with** the VITE_ prefix in your .env file for development.
In production use the same name **without** the VITE_ prefix under Project:Settings:Environment variables in the Cloudflare pages dashboard
The repository has an example called SPECIAL_ENV_VAR

### waitUntil
It's useful to be able to access waitUntil to make sure something executes to completion asyncronously.
The WAITUNTIL binding (I used capitals so I don't confuse it wth the original call) will return Cloudflares waitUntil in production.
In development WAITUNTIL stubs an empty function.

### KV Stores
You can access any number of KV stores in your project but:
1) They must be bound to a variable starting with the letters KV
2) For each store you need to create a separate worker outside your project with it's own KV binding to access it when running vite in development

Once you have created the development kv worker the bindings.js devKV function will take the url of the worker and map the basic get, put, list and delete functions to the respective fetch calls.  The src for the worker is in workers/dev-kv-connector/dev-kv-connector.js.  You should be able to deploy this to your Cloudflare stack using wrangler publish from the workers/dev-kv-connector directory.

Once published you should get a public route that looks something like:
dev-kv-connector.<your org>.workers.dev

This needs to be added as a URL in your .env file with the VITE_ prefix then the name of the store beginning with KV.  In this demo we use a single store called KV so the .env file has:
````
VITE_KV=https:dev-kv-connector.<your org>.workers.dev
````
If we wanted to reference a store called KVUSERS it we would need
````
VITE_KVUSERS=https:<dev-kv-workername>.<your org>.workers.dev
````

Because your worker is opening a public URL to your development KV store we need to add a shared secret to stop anyone else storing arbitrary values and racking up Cloudflare charges.  You can add this in the .env file as VITE_SECRET eg:
````
VITE_SECRET=yoursecret
````
This needs to be the same value as the wrokers ACCESS_KEY environment variable which you can set in the wrangler.toml file or through the Cloudflare workers dashboard under Settings:Variables

Currently bindings.js assumes you will use the same secret across all stores/durable objects.  You'll need to modify the bindings.js source if that's not the case


### Durable objects
For durable objects we basically use the same method however each durable object class already has a fetch handler associated with it so the same durable object code can be used for development and production - we just create two workers one with a route for development and one without a route for production.

To access a durable object via bindings.js:
1) Each durable object must be bound to a variable starting with the letters DO
2) The durable object fetch request must return objects based on a header that is one of: newUniqueId, idFromName or idFromString (see below)

Once you have the bindings configured you can access your durable object directly from the binding name eg:
````
    const id = DOCRYPT.idFromName('1');
    const obj = DOCRYPT.get(id);
    const resp = await obj.fetch('/', {
        issuer: 'dummy'
    })
    const publicKey = await resp.text();
````
(example from src/routes/index.js)

You can find the source to the full DOcrypt durable object at: 
https://gitlab.com/athatch/DOcrypt

Like KV stores you need a reference to the route for the durable oject in your .env file eg:
````
VITE_DOCRYPT=https://docrypt-dev.<your org>.workers.dev
````

For the bindings.js devDO function to work generically with any durable object it expects that the object's fetch request will return a header into the object id.
For idFromName calls it will pass a idFromName: [name] header in the fetch request.
For idFromString calls it will a idFromString: [string] header in the fetch request.
For newUniqueId calls it will a newUniqueId: true header in the fetch request.
Your durable object fetch handler must be able to extract the correct header or headers and generate the appropriate id.  Here's the Docrypt handler (which only expects idFromName requests):
````
async function handleRequest(request, env) {
  if (request.headers.get('Access-Key') !== env.ACCESS_KEY) {
    return new Response('Forbidden',{ status: 403 })
  }
  const version = request.headers.get('idFromName');
  if (!version) return new Response('Version must be supplied in a request header called idFromName ',{status: 400})
  const id = env.DOCRYPT.idFromName(version);
  let obj = env.DOCRYPT.get(id);
  return obj.fetch(request, {
    headers: {
      issuer: env.ISSUER,
      "Content-Type": request.headers.get("Content-Type")
    },
  });
}
````


## Installing in your Cloudflare pages SvelteKit project

To get started in your own project you probably just want to copy the bindings.js file to your lib directory and add the bindTo call to your hooks.js file.

Then for any KV store you'll need to:
Create a dev kv connector (you can use the code in the workers directory) with bindings to a store starting with KV
Make sure the production store is bound using the same name starting with KV to your cloudflare pages site (Dashboard:Pages:Project:Settings:functions)
Add the dev kv worker url to your .env file starting VITE_KV...
Make sure the new worker has an ACCESS_KEY environment variable that matches your VITE_SECRET in the .env file

For any durable object you'll need to:
Create a dev copy of the durable object with a route making sure the fetch handler interprets the id headers outlined above and that it rejects requests without the correct ACCESS_KEY header
Add the dev durable object url to your .env file starting VITE_DO...
Make sure the production durable object is bound using the same name starting with DO to your cloudflare pages site 
Make sure the development durable object has an ACCESS_KEY environment variable that matches your VITE_SECRET in the .env file


## Installing the demo
````
# To install DOcrypt durable object
git clone https://gitlab.com/athatch/DOcrypt.git
cd DOcrypt
mv example.wrangler.toml wrangler.toml
# edit the wrangler.toml with your cloudflare settings
cd ..

# To install this repo locally
git clone https://gitlab.com/athatch/bindings-demo.git
cd bindings-demo
npm install

# To install the dev KV connector
cd worker/dev-kv-connector
wrangler publish

# You should now be able to run
npm run dev
# and have a working development version

# It doesn't look like you can easily publish to cloudflare pages from a public repository so to install on cloudflare we'll using wrangler
npm run build
npx wrangler pages publish .svelte-kit
# once your site is published navigate to Cloudfare Dashboard:Pages:Project:Settings:Functions and create KV and durable object bindings
# (it's ok in this case to bind to the same ones you are using in development but normally we'd use separate ones)
#
# Navigate to your pages site and you should also have a working production version