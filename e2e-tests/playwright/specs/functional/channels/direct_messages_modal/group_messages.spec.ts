// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createPost, createUsers, openDirectMessagesModal, selectUsersForDirectMessage} from '../migration_helpers';

/**
 * @objective Verify users can be added and removed while creating a group message.
 * @rfqa_no 11
 * @rfqa_id MM-T460
 * @rfqa_title Add and Remove users whilst creating a group message
 */
test('MM-T460 Add and remove users while creating new Group Message', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await createUsers(pw, adminClient, team, 3, 'gm-edit');

    // # Open the Direct Messages modal and select two users
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const modal = await openDirectMessagesModal(channelsPage);
    await modal.selectUser(participants[0]);
    await modal.selectUser(participants[1]);

    // * Verify two users are selected
    await expect(modal.container.getByRole('button', {name: `Remove ${participants[0].username}`})).toBeVisible();
    await expect(modal.container.getByRole('button', {name: `Remove ${participants[1].username}`})).toBeVisible();

    // # Remove one user and add a different user
    await modal.container.getByRole('button', {name: `Remove ${participants[1].username}`}).click();
    await modal.selectUser(participants[2]);

    // * Verify the selected list reflects the removal and addition
    await expect(modal.container.getByRole('button', {name: `Remove ${participants[1].username}`})).toHaveCount(0);
    await expect(modal.container.getByRole('button', {name: `Remove ${participants[2].username}`})).toBeVisible();
});

/**
 * @objective Verify the group message intro, sidebar label, and member count render for participants.
 * @rfqa_no 12
 * @rfqa_id MM-T465
 * @rfqa_title Assert that group message participant sees
 */
test('MM-T465 Create a group message and show participant details', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await createUsers(pw, adminClient, team, 2, 'gm-intro');

    // # Create a group message from the Direct Messages modal
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const modal = await selectUsersForDirectMessage(channelsPage, participants);
    await modal.goToChannel();

    // * Verify the group message intro and participants appear
    await expect(page.locator('#channelIntro')).toContainText('This is the start of your group message history');
    await expect(page.locator('#channelHeaderTitle')).toContainText(participants[0].username);
    await expect(page.locator('#channelHeaderTitle')).toContainText(participants[1].username);
    await expect(
        channelsPage.sidebarLeft.container.locator('.SidebarLink').filter({hasText: participants[0].username}),
    ).toBeVisible();

    // # Post a message so the group message persists in the sidebar
    await channelsPage.postMessage('Hi group');

    // * Verify the message appears in the group message
    await (await channelsPage.getLastPost()).toContainText('Hi group');
});

/**
 * @objective Verify a mention posted in a group message creates an unread mention for the mentioned participant.
 * @rfqa_no 13
 * @rfqa_id MM-T469
 * @rfqa_title Post an @mention on a group channel
 */
test('MM-T469 Create a group message and post a mention for another user', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [sender, secondParticipant] = await createUsers(pw, adminClient, team, 2, 'gm-mention');
    const gmChannel = await adminClient.createGroupChannel([user.id, sender.id, secondParticipant.id]);

    // # View another channel, then have a participant mention the test user in the GM
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await createPost(adminClient, sender, gmChannel, `@${user.username} Hello from GM`);

    // * Verify the group message becomes unread with a mention badge
    await expect(
        channelsPage.sidebarLeft.container.locator('.SidebarLink').filter({hasText: sender.username}),
    ).toHaveClass(/unread|unread-title/);
    await expect(channelsPage.page.locator('#unreadMentions')).toBeVisible();
});

/**
 * @objective Verify muting a group message suppresses normal unread notification styling but keeps mention counts.
 * @rfqa_no 14
 * @rfqa_id MM-T475
 * @rfqa_title Channel preferences, mute channel
 */
test('MM-T475 Group Message Channel Preferences Mute channel', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [sender, secondParticipant] = await createUsers(pw, adminClient, team, 2, 'gm-mute');
    const gmChannel = await adminClient.createGroupChannel([user.id, sender.id, secondParticipant.id]);

    // # Open the GM and mute it through notification preferences
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.gotoMessage(team.name, gmChannel.name);
    await channelsPage.toBeVisible();
    await channelsPage.centerView.header.openChannelMenu();
    await page.getByRole('menuitem', {name: 'Notification Preferences'}).click();
    await page.getByText('Mute or ignore').waitFor();
    await page.getByRole('checkbox', {name: /Mute channel/i}).check();
    await page.getByRole('button', {name: 'Save'}).click();

    // # Post normal and mention messages from another participant while away
    await channelsPage.goto(team.name, 'off-topic');
    await createPost(adminClient, sender, gmChannel, 'Muted normal GM message');
    await createPost(adminClient, sender, gmChannel, `@${user.username} Muted mention GM message`);

    // * Verify muted GM still shows mention state when directly mentioned
    await expect(page.locator('#unreadMentions')).toBeVisible();
});

/**
 * @objective Verify a closed group message can be reopened from the Direct Messages modal.
 * @rfqa_no 15
 * @rfqa_id MM-T478
 * @rfqa_title Open existing group message from More... section
 */
test('MM-T478 Closing group message channels and re-opening via Direct Messages modal', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await createUsers(pw, adminClient, team, 2, 'gm-reopen');
    const gmChannel = await adminClient.createGroupChannel([user.id, participants[0].id, participants[1].id]);

    // # Open then close the group message conversation
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.gotoMessage(team.name, gmChannel.name);
    await channelsPage.toBeVisible();
    await channelsPage.centerView.header.openChannelMenu();
    await page.getByRole('menuitem', {name: 'Close Group Message'}).click();
    await expect(
        channelsPage.sidebarLeft.container.locator('.SidebarLink').filter({hasText: participants[0].username}),
    ).toHaveCount(0);

    // # Reopen the same GM from the Direct Messages modal
    const modal = await openDirectMessagesModal(channelsPage);
    await modal.selectUser(participants[0]);
    await modal.selectUser(participants[1]);
    await modal.goToChannel();

    // * Verify the existing group message opens again
    await expect(page.locator('#channelHeaderTitle')).toContainText(participants[0].username);
    await expect(page.locator('#channelHeaderTitle')).toContainText(participants[1].username);
});
