import { KlasaMessage, CommandStore } from 'klasa';
import { Util } from 'oldschooljs';

import { BotCommand } from '../../lib/BotCommand';
import { UserSettings } from '../../lib/settings/types/UserSettings';
import { ClientSettings } from '../../lib/settings/types/ClientSettings';
import itemIsTradeable from '../../lib/util/itemIsTradeable';
import getOSItem from '../../lib/util/getOSItem';

const options = {
	max: 1,
	time: 10000,
	errors: ['time']
};

export default class extends BotCommand {
	public constructor(store: CommandStore, file: string[], directory: string) {
		super(store, file, directory, {
			cooldown: 1,
			usage: '[quantity:int{1}] <itemname:...string>',
			usageDelim: ' ',
			oneAtTime: true,
			ironCantUse: true
		});
	}

	async run(msg: KlasaMessage, [quantity, itemName]: [number | undefined, string]) {
		if (msg.author.isIronman) throw `Iron players can't sell items.`;
		const osItem = getOSItem(itemName);

		if (!itemIsTradeable(osItem.id)) {
			throw `That item isn't tradeable.`;
		}

		const numItemsHas = await msg.author.numberOfItemInBank(osItem.id);
		if (numItemsHas === 0) throw `You don't have any of this item to sell!`;

		if (!quantity) {
			quantity = numItemsHas;
		}

		const priceOfItem = await this.client.fetchItemPrice(osItem.id);
		let totalPrice = priceOfItem * quantity;

		if (quantity > numItemsHas) {
			throw `You dont have ${quantity}x ${osItem.name}.`;
		}

		if (totalPrice > 3) {
			totalPrice = Math.floor(totalPrice * 0.8);
		}

		if (!msg.flagArgs.confirm && !msg.flagArgs.cf) {
			const sellMsg = await msg.channel.send(
				`${msg.author}, say \`confirm\` to sell ${quantity} ${
					osItem.name
				} for ${totalPrice.toLocaleString()} (${Util.toKMB(totalPrice)}).`
			);

			try {
				await msg.channel.awaitMessages(
					_msg =>
						_msg.author.id === msg.author.id &&
						_msg.content.toLowerCase() === 'confirm',
					options
				);
			} catch (err) {
				return sellMsg.edit(`Cancelling sale of ${quantity}x ${osItem.name}.`);
			}
		}

		await msg.author.removeItemFromBank(osItem.id, quantity);
		await msg.author.settings.update(
			UserSettings.GP,
			msg.author.settings.get(UserSettings.GP) + totalPrice
		);

		const itemSellTaxBank = this.client.settings.get(
			ClientSettings.EconomyStats.ItemSellTaxBank
		);
		const dividedAmount = (priceOfItem * quantity * 0.2) / 1_000_000;
		this.client.settings.update(
			ClientSettings.EconomyStats.ItemSellTaxBank,
			Math.floor(itemSellTaxBank + Math.round(dividedAmount * 100) / 100)
		);

		msg.author.log(`sold Quantity[${quantity}] ItemID[${osItem.id}] for ${totalPrice}`);

		return msg.send(
			`Sold ${quantity}x ${osItem.name} for ${totalPrice.toLocaleString()}gp (${Util.toKMB(
				totalPrice
			)})`
		);
	}
}
