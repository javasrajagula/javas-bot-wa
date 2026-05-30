import prisma from '../../db/client.js';

const DEFAULT_SHOP_ITEMS = [
  { name: 'makanan pet', type: 'food', price: 100, metadataJson: JSON.stringify({ effect: 'pet_food' }) },
  { name: 'title keren', type: 'title', price: 500, metadataJson: JSON.stringify({ effect: 'custom_title' }) },
  { name: 'lootbox', type: 'lootbox', price: 300, metadataJson: JSON.stringify({ effect: 'random_reward' }) }
];

export async function seedSystemDefaults(): Promise<void> {
  for (const item of DEFAULT_SHOP_ITEMS) {
    await prisma.shopItem.upsert({
      where: { name: item.name },
      create: item,
      update: {
        type: item.type,
        price: item.price,
        metadataJson: item.metadataJson,
        enabled: true
      }
    });
  }

  const groups = await prisma.groupConfig.findMany({ select: { groupId: true } });
  for (const group of groups) {
    const existingRule = await prisma.warningRule.findFirst({
      where: {
        groupId: group.groupId,
        threshold: 3,
        action: 'kick'
      }
    });
    if (!existingRule) {
      await prisma.warningRule.create({
        data: {
          groupId: group.groupId,
          threshold: 3,
          action: 'kick'
        }
      });
    }
  }
}
