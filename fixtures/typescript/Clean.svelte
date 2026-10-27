<script lang="ts">
  import type { Order } from "./orders";
  let { order }: { order: Order } = $props();
</script>

<!-- Markup can hold anything a code rule would flag in a script. -->
<p>{order.customer!.name} · as any · console.log(order)</p>
<button onclick={() => { try { save(); notify(); } catch {} }}>Save</button>
