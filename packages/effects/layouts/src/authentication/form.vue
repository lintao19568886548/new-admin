<script setup lang="ts">
defineOptions({
  name: 'AuthenticationFormView',
});
</script>

<template>
  <div
    class="flex-col-center dark:bg-background-deep bg-background relative px-6 py-10 lg:flex-initial lg:px-8"
  >
    <slot></slot>
    <!-- Router View -->
    <RouterView v-slot="{ Component, route }">
      <div :key="route.fullPath" class="mt-6 w-full sm:mx-auto md:max-w-md">
        <component :is="Component" />
      </div>
    </RouterView>

    <!-- Footer Copyright -->

    <div
      class="text-muted-foreground absolute bottom-3 flex text-center text-xs"
    >
      <slot name="copyright"> </slot>
    </div>
  </div>
</template>
