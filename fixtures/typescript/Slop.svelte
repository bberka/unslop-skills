<script lang="ts">
  let { order }: { order: any } = $props();
  console.log(order);
</script>

<p>{order!.customer!.name}</p>
