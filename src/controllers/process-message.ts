import { Context } from 'telegraf';

import { Action, getAction } from '../service';
import { Minus, Plus, Post, sequelize } from '../models';


const cooldownSet = new Set<string>();

export const processMessage = async (ctx: Context) => {
  if (!ctx.message) {
    return;
  }
  if (!('reply_to_message' in ctx.message)) {
    return;
  }

  const text = 'text' in ctx.message ? ctx.message.text : 'sticker' in ctx.message ? ctx.message.sticker.emoji : '';

  if (!text) {
    return;
  }

  const action = getAction(text)

  if (action === Action.none) {
    return;
  }

  if (ctx.message.reply_to_message?.from?.id === ctx.message.from.id) {
    const url = await ctx.tg.getFileLink('CAACAgIAAxkBAAMoYDqZhNYMEOhZMgABZr5tG1bko4MUAAJ2AAMz-LcVOuDuXdTVMogeBA')

    if (url?.href) {
      ctx.replyWithSticker({ url: url.href }, { reply_to_message_id: ctx.message.message_id });
    } else {
      ctx.reply('Ну ты ещё сам себе отсосать бы попробовал. Долбоёб!', { reply_to_message_id: ctx.message.message_id });
    }
    return;
  }

  if (ctx.message.reply_to_message?.from?.id === (await ctx.telegram.getMe()).id) {
    ctx.reply('А ты случаем не ахуел меня оценивать??? Долбоёб!', { reply_to_message_id: ctx.message.message_id });
    return;
  }

  const chatId = ctx.chat?.id;
  const objectId = ctx.message.reply_to_message?.from?.id;
  const messageId = ctx.message.reply_to_message?.message_id;
  console.log(ctx.message.reply_to_message);


  const subjectId = ctx.message.from?.id;
  const objectUserName = ctx.message.reply_to_message?.from?.username || 'Безымянный пидр';
  const subjectUserName = ctx.message.from?.username || 'Безымянный пидр';

  if (!chatId || !objectId || !subjectId || !messageId) {
    return;
  }

  const url = `https://t.me/c/${chatId.toString().slice(4)}/${messageId}`;


  const cooldownKey = `${chatId}:${objectId}:${ctx.message.from.id}`;

  if (cooldownSet.has(cooldownKey)) {
    ctx.reply('Иди в жопу', { reply_to_message_id: ctx.message.message_id });
    return;
  } else {
    cooldownSet.add(cooldownKey);
    setTimeout(() => cooldownSet.delete(cooldownKey), 60 * 1000);
  }


  if (action === Action.plus) {
    const transaction = await sequelize.transaction();

    try {
      const [[plus], [post]] = await Promise.all([
        Plus.findOrCreate({
          where: {
            userId: objectId,
            chatId: chatId,
          },
          defaults: {
            userId: objectId,
            chatId: chatId,
            name: objectUserName,
            value: 0,
          },
          transaction,
        }),
        Post.findOrCreate({
          where: {
            userId: objectId,
            chatId: chatId,
            messageId,
          },
          defaults: {
            userId: objectId,
            chatId,
            messageId,
            plus: 0,
            minus: 0,
            url,
            created: new Date(),
          },
          transaction,
        })
      ]);

      const value = plus.value + 1;

      await plus.update({ value }, { transaction });

      ctx.reply(`${subjectUserName} поднял(a) в топе ${objectUserName}(${value})`);

      const postValue = post.plus + 1;

      await post.update({ plus: postValue }, { transaction });

      await transaction.commit();

    } catch (e) {
      console.error(e);

      await transaction.rollback();
    }
    return;
  }

  if (action === Action.minus) {
    const transaction = await sequelize.transaction();

    try {
      const [[minus], [post]] = await Promise.all([
        Minus.findOrCreate({
          where: {
            userId: objectId,
            chatId: chatId,
          },
          defaults: {
            userId: objectId,
            chatId: chatId,
            name: objectUserName,
            value: 0,
          },
          transaction,
        }),
        Post.findOrCreate({
          where: {
            userId: objectId,
            chatId: chatId,
            messageId,
          },
          defaults: {
            userId: objectId,
            chatId,
            messageId,
            plus: 0,
            minus: 0,
            url,
            created: new Date(),
          },
          transaction,
        })
      ]);

      const value = minus.value + 1;

      await minus.update({ value }, { transaction });

      ctx.reply(`${subjectUserName} опустил(a) на дно ${objectUserName}(-${value})`);

      const postValue = post.minus + 1;

      await post.update({ minus: postValue }, { transaction });

      await transaction.commit();

    } catch (e) {
      console.error(e);
      await transaction.rollback();
    }

    return;
  }

  if (action === Action.plusAndMinus) {
    const transaction = await sequelize.transaction();
    try {
      const [[plus], [minus], [post]] = await Promise.all([
        Plus.findOrCreate({
          where: {
            userId: objectId,
            chatId: chatId,
          },
          defaults: {
            userId: objectId,
            chatId: chatId,
            name: objectUserName,
            value: 0,
          },
          transaction,
        }),
        Minus.findOrCreate({
          where: {
            userId: objectId,
            chatId: chatId,
          },
          defaults: {
            userId: objectId,
            chatId: chatId,
            name: objectUserName,
            value: 0,
          },
          transaction,
        }),
        Post.findOrCreate({
          where: {
            userId: objectId,
            chatId: chatId,
            messageId,
          },
          defaults: {
            userId: objectId,
            chatId,
            messageId,
            plus: 0,
            minus: 0,
            url,
            created: new Date(),
          },
          transaction,
        })
      ]);

      const plusValue = plus.value + 1;
      const minusValue = minus.value + 1;

      await Promise.all([
        plus.update({ value: plusValue }, { transaction }),
        minus.update({ value: minusValue }, { transaction }),
      ]);

      ctx.reply(`${subjectUserName} поднял(а) в топе и опустил(а) на дно ${objectUserName}(+${plusValue};-${minusValue})`);

      const postPlusValue = post.plus + 1;
      const postMinusValue = post.minus + 1;

      await post.update({ plus: postPlusValue, minus: postMinusValue }, { transaction });

      await transaction.commit();

    } catch (e) {
      console.error(e);
      await transaction.rollback();
    }
    return;
  }

}
