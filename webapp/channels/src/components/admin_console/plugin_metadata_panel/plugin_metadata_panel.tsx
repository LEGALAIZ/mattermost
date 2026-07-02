// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';

import CopyButton from 'components/copy_button';
import ExternalLink from 'components/external_link';

import './plugin_metadata_panel.scss';

const messages = defineMessages({
    releaseNotes: {
        id: 'admin.plugin.metadata.releaseNotes',
        defaultMessage: 'release notes',
    },
});

export function formatPluginVersion(version: string): string {
    if (!version) {
        return version;
    }

    return (/^v/i).test(version) ? version : `v${version}`;
}

export type PluginMetadataPanelProps = {
    name: string;
    id: string;
    version: string;
    homepageUrl?: string;
    releaseNotesUrl?: string;
    className?: string;
};

const PluginMetadataPanel = ({
    name,
    id,
    version,
    homepageUrl,
    releaseNotesUrl,
    className,
}: PluginMetadataPanelProps) => {
    const formattedVersion = formatPluginVersion(version);

    let nameElement: React.ReactNode = <strong>{name}</strong>;
    if (homepageUrl) {
        nameElement = (
            <ExternalLink
                href={homepageUrl}
                location='plugin_metadata_panel'
            >
                <strong>{name}</strong>
            </ExternalLink>
        );
    }

    return (
        <span
            className={classNames('PluginMetadataPanel', className)}
            data-testid='plugin-metadata-panel'
        >
            {nameElement}
            {' ('}
            <span className='PluginMetadataPanel__idWrapper'>
                <code
                    className='PluginMetadataPanel__id'
                    data-testid='plugin-metadata-id'
                >
                    {id}
                </code>
                <CopyButton
                    content={id}
                    isForText={true}
                    className='PluginMetadataPanel__copy'
                />
            </span>
            {' - '}
            <span data-testid='plugin-metadata-version'>{formattedVersion}</span>
            {releaseNotesUrl && (
                <>
                    {' - '}
                    <ExternalLink
                        href={releaseNotesUrl}
                        location='plugin_metadata_panel'
                    >
                        <FormattedMessage {...messages.releaseNotes}/>
                    </ExternalLink>
                </>
            )}
            {')'}
        </span>
    );
};

export default PluginMetadataPanel;
