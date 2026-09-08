import { describe, it, expect, afterEach } from 'vitest';
import {
  registerPluginModule,
  unregisterModule,
  getModuleDefinition,
  getAllModuleDefinitions,
  getModulesByCategory,
  getActiveCategories,
  MODULE_CATEGORIES,
} from '@/lib/module-registry';
import type { PluginManifest } from '@/types/plugins';
import type { ModuleType } from '@/types/config';
import { Puzzle } from 'lucide-react';

const testManifest: PluginManifest = {
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin',
  author: 'tester',
  license: 'MIT',
  minAppVersion: '0.16.0',
  moduleType: 'test-widget',
  category: 'Weather & Environment',
  icon: 'NonExistent', // should fall back to Puzzle
  defaultConfig: { foo: 'bar' },
  defaultSize: { w: 500, h: 400 },
  exports: { component: 'default' },
  dataRequirements: ['location'],
};

const pluginType: ModuleType = 'plugin:test-widget';

afterEach(() => {
  // Clean up test registrations
  unregisterModule(pluginType);
});

describe('registerPluginModule', () => {
  it('registers a plugin with the plugin: prefix', () => {
    registerPluginModule(testManifest);
    const def = getModuleDefinition(pluginType);
    expect(def).toBeDefined();
    expect(def!.type).toBe('plugin:test-widget');
  });

  it('maps manifest fields correctly', () => {
    registerPluginModule(testManifest);
    const def = getModuleDefinition(pluginType)!;
    expect(def.label).toBe('Test Plugin');
    expect(def.category).toBe('Weather & Environment');
    expect(def.defaultConfig).toEqual({ foo: 'bar' });
    expect(def.defaultSize).toEqual({ w: 500, h: 400 });
    expect(def.dataRequirements).toEqual(['location']);
  });

  it('falls back to Puzzle icon for unknown icon names', () => {
    registerPluginModule(testManifest);
    const def = getModuleDefinition(pluginType)!;
    expect(def.icon).toBe(Puzzle);
  });

  it('falls back to default size when manifest omits defaultSize', () => {
    const manifest = { ...testManifest, defaultSize: undefined as unknown as { w: number; h: number } };
    registerPluginModule(manifest);
    const def = getModuleDefinition(pluginType)!;
    expect(def.defaultSize).toEqual({ w: 400, h: 300 });
  });

  it('appears in getAllModuleDefinitions', () => {
    registerPluginModule(testManifest);
    const all = getAllModuleDefinitions();
    expect(all.some((d) => d.type === pluginType)).toBe(true);
  });

  it('appears in getModulesByCategory under the correct category', () => {
    registerPluginModule(testManifest);
    const byCategory = getModulesByCategory();
    const weatherModules = byCategory.get('Weather & Environment') ?? [];
    expect(weatherModules.some((d) => d.type === pluginType)).toBe(true);
  });

  it('creates a custom category group for unknown category', () => {
    const customManifest = { ...testManifest, category: 'Smart Home' as never };
    registerPluginModule(customManifest);
    const byCategory = getModulesByCategory();
    // The plugin should appear under its custom category
    const smartHomeModules = byCategory.get('Smart Home') ?? [];
    expect(smartHomeModules.some((d) => d.type === pluginType)).toBe(true);
  });
});

describe('unregisterModule', () => {
  it('removes a previously registered plugin', () => {
    registerPluginModule(testManifest);
    expect(getModuleDefinition(pluginType)).toBeDefined();
    unregisterModule(pluginType);
    expect(getModuleDefinition(pluginType)).toBeUndefined();
  });

  it('is a no-op for non-existent types', () => {
    // Should not throw
    unregisterModule('plugin:nonexistent');
  });
});

describe('registerPluginModule — defaultStyle', () => {
  afterEach(() => {
    unregisterModule(pluginType);
  });

  it('passes defaultStyle through to the definition', () => {
    const manifest = { ...testManifest, defaultStyle: { padding: 0, opacity: 0.8 } };
    registerPluginModule(manifest);
    const def = getModuleDefinition(pluginType)!;
    expect(def.defaultStyle).toEqual({ padding: 0, opacity: 0.8 });
  });

  it('leaves defaultStyle undefined when manifest omits it', () => {
    registerPluginModule(testManifest);
    const def = getModuleDefinition(pluginType)!;
    expect(def.defaultStyle).toBeUndefined();
  });
});

describe('getActiveCategories', () => {
  afterEach(() => {
    unregisterModule(pluginType);
    unregisterModule('plugin:widget-a');
    unregisterModule('plugin:widget-b');
  });

  it('returns built-in categories when no plugins registered', () => {
    const categories = getActiveCategories();
    expect(categories).toEqual([...MODULE_CATEGORIES]);
  });

  it('includes custom plugin categories after built-ins, sorted alphabetically', () => {
    // Register two plugins with different custom categories
    const manifestA = { ...testManifest, moduleType: 'widget-a', category: 'Zebra' as never };
    const manifestB = { ...testManifest, id: 'test-b', moduleType: 'widget-b', category: 'Automation' as never };
    registerPluginModule(manifestA);
    registerPluginModule(manifestB);

    const categories = getActiveCategories();
    // Built-in categories come first
    for (let i = 0; i < MODULE_CATEGORIES.length; i++) {
      expect(categories[i]).toBe(MODULE_CATEGORIES[i]);
    }
    // Custom categories after, sorted
    const customStart = MODULE_CATEGORIES.length;
    expect(categories[customStart]).toBe('Automation');
    expect(categories[customStart + 1]).toBe('Zebra');
  });

  it('does not duplicate built-in categories used by plugins', () => {
    registerPluginModule(testManifest); // uses 'Weather & Environment'
    const categories = getActiveCategories();
    const weatherCount = categories.filter((c) => c === 'Weather & Environment').length;
    expect(weatherCount).toBe(1);
  });

  it('deduplicates when multiple plugins share the same custom category', () => {
    const manifestA = { ...testManifest, moduleType: 'widget-a', category: 'Smart Home' as never };
    const manifestB = { ...testManifest, id: 'test-b', moduleType: 'widget-b', category: 'Smart Home' as never };
    registerPluginModule(manifestA);
    registerPluginModule(manifestB);

    const categories = getActiveCategories();
    const smartHomeCount = categories.filter((c) => c === 'Smart Home').length;
    expect(smartHomeCount).toBe(1);

    // Both plugins should appear in that single category group
    const byCategory = getModulesByCategory();
    const smartHomeModules = byCategory.get('Smart Home') ?? [];
    expect(smartHomeModules).toHaveLength(2);
  });
});
