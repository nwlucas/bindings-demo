<script>
export let envVar, publicKey, kvList
</script>

<h1>Vite development bindings for Cloudflare pages deployed SvelteKit</h1>
<p>
    {kvList.keys.length} keys in KV store:
</p>
<ul>
    {#each kvList.keys as key}
    <li>{key.name}</li>
    {/each}
</ul>
<p>
    Special environment variable is: {envVar}
</p>
<p>
    Docrypt public key is:<br>
    {publicKey}
</p>
