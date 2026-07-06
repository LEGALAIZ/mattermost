// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel, ChannelType} from '@mattermost/types/channels';

type ChannelInput = {
    teamId: string;
    name: string;
    displayName: string;
    type?: ChannelType;
    purpose?: string;
    header?: string;
    unique?: boolean;
};

function getRandomSuffix(): string {
    return Math.random().toString(36).substring(2, 9);
}

export function createRandomChannel(channelInput: ChannelInput): Channel {
    const channel = {
        team_id: channelInput.teamId,
        name: channelInput.name,
        display_name: channelInput.displayName,
        type: channelInput.type || 'O',
        purpose: channelInput.type || '',
        header: channelInput.type || '',
    };

    if (channelInput.unique) {
        const randomSuffix = getRandomSuffix();

        channel.name = `${channelInput.name}-${randomSuffix}`;
        channel.display_name = `${channelInput.displayName} ${randomSuffix}`;
    }

    return channel as Channel;
}

export async function createPublicChannel(
    client: Client4,
    teamId: string,
    displayName = 'Public',
    name?: string,
): Promise<Channel> {
    return client.createChannel(
        createRandomChannel({
            teamId,
            name: name ?? displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            displayName,
            unique: true,
        }),
    );
}
