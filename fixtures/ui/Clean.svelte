<script lang="ts">
  let { src, alt, title }: { src: string; alt: string; title: string } = $props();
</script>

<svelte:head><title>{title} · Studio</title></svelte:head>
<img
  {src}
  {alt}
  loading="lazy"
/>
<button type="button" onclick={() => history.back()}>Back to games</button>
