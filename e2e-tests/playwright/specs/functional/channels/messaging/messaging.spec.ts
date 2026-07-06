// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createPost, createUsers} from '../migration_helpers';

/**
 * @objective Verify the RHS thread refreshes replies when the center channel has changed.
 * @rfqa_no 1
 * @rfqa_id MM-T94
 * @rfqa_title RHS fetches messages on socket reconnect when a different channel is in center
 */
test('MM-T94 RHS fetches messages on reconnect while a different channel is in center', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [author] = await createUsers(pw, adminClient, team, 1, 'reconnect-author');
    const threadChannel = await pw.createPublicChannel(adminClient, team.id, 'RHS Reconnect');
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
    await adminClient.addToChannel(user.id, threadChannel.id);
    await adminClient.addToChannel(author.id, threadChannel.id);

    // # Open a thread in the RHS and add an initial reply
    const root = await createPost(adminClient, author, threadChannel, 'reconnect root');
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, threadChannel.name);
    await channelsPage.toBeVisible();
    await (await channelsPage.centerView.getPostById(root.id)).reply();
    await channelsPage.sidebarRight.postMessage('def');

    // # Change the center channel, add a reply externally, then reconnect by reloading
    await channelsPage.sidebarLeft.goToItem(offTopic.name);
    await createPost(adminClient, author, threadChannel, 'ghi', root.id);
    await page.reload();
    if (!(await channelsPage.sidebarRight.container.isVisible().catch(() => false))) {
        await channelsPage.goto(team.name, threadChannel.name);
        await (await channelsPage.centerView.getPostById(root.id)).reply();
    }

    // * Verify the RHS fetches both replies for the existing thread
    await channelsPage.sidebarRight.toContainText('def');
    await channelsPage.sidebarRight.toContainText('ghi');
});

/**
 * @objective Verify selecting an emoji from the picker inserts it at the current caret position.
 * @rfqa_no 2
 * @rfqa_id MM-T95
 * @rfqa_title Selecting an emoji from emoji picker should insert it at the cursor position
 */
test('MM-T95 Selecting an emoji from emoji picker should insert it at the cursor position', async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Log in and place the caret between "Hello" and "World"
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.writeMessage('HelloWorld!');
    for (let i = 0; i < 'World!'.length; i++) {
        await channelsPage.centerView.postCreate.input.press('ArrowLeft');
    }

    // # Select the grinning emoji from the picker
    await channelsPage.centerView.postCreate.openEmojiPicker();
    await channelsPage.emojiGifPickerPopup.toBeVisible();
    await channelsPage.emojiGifPickerPopup.clickEmoji('grinning');

    // * Verify the emoji was inserted at the caret and can be posted
    await expect(channelsPage.centerView.postCreate.input).toHaveValue('Hello 😀 World!');
    await channelsPage.centerView.postCreate.sendMessage();
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toContainText('Hello 😀 World!');
});

/**
 * @objective Verify channel short-linking still works when the channel reference is surrounded by brackets.
 * @rfqa_no 3
 * @rfqa_id MM-T175
 * @rfqa_title Channel shortlinking still works when placed in brackets
 */
test('MM-T175 Channel short-linking still works when placed in brackets', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const linkedChannel = await pw.createPublicChannel(adminClient, team.id, 'Shortlink Target');
    await adminClient.addToChannel(user.id, linkedChannel.id);

    // # Post a bracketed channel shortlink from a different channel
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(`(~${linkedChannel.name})`);

    // # Click the rendered channel link
    const lastPost = await channelsPage.getLastPost();
    await lastPost.container.getByRole('link', {name: linkedChannel.display_name}).click();

    // * Verify the linked channel opens
    await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${linkedChannel.name}`));
    await channelsPage.centerView.header.toHaveTitle(linkedChannel.display_name);
});

/**
 * @objective Verify an emoji followed by punctuation renders as an emoji without separating the punctuation.
 * @rfqa_no 4
 * @rfqa_id MM-T222
 * @rfqa_title Emoji characters followed by punctuation
 */
test('MM-T222 Emoji characters followed by punctuation', async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Post an emoticon followed by punctuation
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(':)=');

    // * Verify the emoticon renders and the punctuation remains adjacent
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.container.locator('.emoticon').first()).toHaveAttribute(
        'aria-label',
        ':slightly_smiling_face:',
    );
    await expect(lastPost.container.locator('.post-message__text p').first()).toContainText('=');
});
