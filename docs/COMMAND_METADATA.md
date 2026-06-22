# Command Metadata Specification — Javas Bot WA

This document specifies the schema, roles, and validation rules used for registration of commands in Javas Bot WA.

## Metadata Schema

Every command MUST supply metadata adhering to the `CommandMetadata` interface:

```ts
export interface CommandMetadata {
  name: string;          // Primary command trigger
  aliases: string[];     // Array of alternative triggers
  category: string;      // Categorization for help /menu
  plugin: string;        // Target plugin context
  featureFlag: string;   // feature flag key for group checks
  minRole?: UserRole;    // Required permission level (user, premium, admin, owner)
  premiumOnly?: boolean; // Restrict command to premium profiles
  rateLimitKey?: string; // Custom rate limit isolation key
  description: string;   // Short description shown in help
  usage: string;         // Example invocation guide
  examples: string[];    // Array of mock inputs
}
```

## User Roles Hierarchy

Privileges escalate in the following order:

1. **User (1)**: Basic commands, games, and profile viewing.
2. **Premium (2)**: Higher quotas, advanced downloader access, premium commands.
3. **Admin (3)**: Moderation commands (kick, mute, warn, lockdowns).
4. **Owner (4)**: Global state settings, sewa configs, system updates.
