// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {UserPropertyField} from '@mattermost/types/properties';
import {isSessionAttributeField} from '@mattermost/types/properties';

import Markdown from 'components/markdown';

import './shared.scss';

// Sentinel emitted by the server in masked CEL expressions for values the caller cannot see.
export const MASKED_VALUE_TOKEN_LITERAL = '"--------"';

// CEL operator constants
export enum CELOperator {
    EQUALS = '==',
    NOT_EQUALS = '!=',
    STARTS_WITH = 'startsWith',
    ENDS_WITH = 'endsWith',
    CONTAINS = 'contains',
    IN = 'in',
}

// Operator label constants
export enum OperatorLabel {
    IS = 'is',
    IS_NOT = 'is not',
    STARTS_WITH = 'starts with',
    ENDS_WITH = 'ends with',
    CONTAINS = 'contains',
    IN = 'in',
    HAS_ANY_OF = 'has any of',
    HAS_ALL_OF = 'has all of',
}

// Map from visual AST operator to UI label
export const OPERATOR_LABELS: Record<string, string> = {
    [CELOperator.EQUALS]: OperatorLabel.IS,
    [CELOperator.NOT_EQUALS]: OperatorLabel.IS_NOT,
    [CELOperator.STARTS_WITH]: OperatorLabel.STARTS_WITH,
    [CELOperator.ENDS_WITH]: OperatorLabel.ENDS_WITH,
    [CELOperator.CONTAINS]: OperatorLabel.CONTAINS,
    [CELOperator.IN]: OperatorLabel.IN,
    hasAnyOf: OperatorLabel.HAS_ANY_OF,
    hasAllOf: OperatorLabel.HAS_ALL_OF,
};

type OperatorType = 'comparison' | 'method' | 'list';

// Map from UI label to operator configuration
export const OPERATOR_CONFIG: Record<string, {type: OperatorType; celOp: CELOperator}> = {
    [OperatorLabel.IS]: {type: 'comparison', celOp: CELOperator.EQUALS},
    [OperatorLabel.IS_NOT]: {type: 'comparison', celOp: CELOperator.NOT_EQUALS},
    [OperatorLabel.STARTS_WITH]: {type: 'method', celOp: CELOperator.STARTS_WITH},
    [OperatorLabel.ENDS_WITH]: {type: 'method', celOp: CELOperator.ENDS_WITH},
    [OperatorLabel.CONTAINS]: {type: 'method', celOp: CELOperator.CONTAINS},
    [OperatorLabel.IN]: {type: 'list', celOp: CELOperator.IN},
    [OperatorLabel.HAS_ANY_OF]: {type: 'list', celOp: CELOperator.IN},
    [OperatorLabel.HAS_ALL_OF]: {type: 'list', celOp: CELOperator.IN},
};

export function isMultiValueOperator(op: string): boolean {
    return op === OperatorLabel.IN || op === OperatorLabel.HAS_ANY_OF || op === OperatorLabel.HAS_ALL_OF;
}

export function isMultiselectOperator(op: string): boolean {
    return op === OperatorLabel.HAS_ANY_OF || op === OperatorLabel.HAS_ALL_OF;
}

export function isSimpleCondition(s: string): boolean {
    const trimmed = s.trim();
    return Boolean(
        trimmed.match(/^user\.(?:attributes|session)\.\w+\s*(==|!=)\s*['"][^'"]*['"]$/) ||
        trimmed.match(/^user\.(?:attributes|session)\.\w+\s+in\s+\[.*?\]$/) ||
        trimmed.match(/^((\[.*?\])|['"][^'"]*['"])\s+in\s+user\.(?:attributes|session)\.\w+$/) ||
        trimmed.match(/^user\.(?:attributes|session)\.\w+\.startsWith\(['"][^'"]*['"].*?\)$/) ||
        trimmed.match(/^user\.(?:attributes|session)\.\w+\.endsWith\(['"][^'"]*['"].*?\)$/) ||
        trimmed.match(/^user\.(?:attributes|session)\.\w+\.contains\(['"][^'"]*['"].*?\)$/),
    );
}

export function isMultiselectOrGroup(s: string): boolean {
    const trimmed = s.trim();
    if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
        return false;
    }
    const inner = trimmed.slice(1, -1);
    return inner.split('||').every((part) => {
        const p = part.trim();
        return Boolean(p.match(/^['"][^'"]*['"]\s+in\s+user\.(?:attributes|session)\.\w+$/));
    });
}

export function isSimpleExpression(expr: string): boolean {
    if (!expr) {
        return true;
    }
    return expr.split('&&').every((condition) => {
        return isSimpleCondition(condition) || isMultiselectOrGroup(condition);
    });
}

// Checks if there are any usable attributes for ABAC policies.
// An attribute is usable if:
// 1. It doesn't contain spaces (CEL incompatible)
// 2. It's either synced from LDAP/SAML, admin-managed, plugin-managed (protected), OR user-managed attributes are enabled
export function hasUsableAttributes(
    userAttributes: UserPropertyField[],
    enableUserManagedAttributes: boolean,
): boolean {
    return userAttributes.some((attr) => {
        const hasSpaces = attr.name.includes(' ');
        const isSynced = attr.attrs?.ldap || attr.attrs?.saml;
        const isAdminManaged = attr.attrs?.managed === 'admin';
        const isProtected = attr.attrs?.protected;
        const allowed = isSynced || isAdminManaged || isProtected || enableUserManagedAttributes;
        return !hasSpaces && allowed;
    });
}

// Membership/parent policy editors operate on long-lived user attributes only.
// Session attributes are environmental and are rejected by the server for
// membership rules, so strip them before they reach the editors.
export function excludeSessionAttributes(fields: UserPropertyField[]): UserPropertyField[] {
    return fields.filter((field) => !isSessionAttributeField(field));
}

// CEL namespaces. CPA/user attributes are referenced as user.attributes.<name>;
// session attributes as user.session.<name> (the server convention).
export const USER_ATTRIBUTE_CEL_PREFIX = 'user.attributes.';
export const SESSION_ATTRIBUTE_CEL_PREFIX = 'user.session.';

// The CEL namespace is chosen by object_type, not by group id.
export function celPrefixForField(field: Pick<UserPropertyField, 'object_type'>): string {
    return isSessionAttributeField(field) ? SESSION_ATTRIBUTE_CEL_PREFIX : USER_ATTRIBUTE_CEL_PREFIX;
}

// Permission surfaces only. Appends enabled session attributes after the user
// attributes. Dedups by id and by object_type:name in case the autocomplete
// endpoint ever starts returning session attributes again. Returns the original
// array when there's nothing to add to preserve referential stability.
export function mergeSessionAttributes(
    autocomplete: UserPropertyField[],
    sessionFields: UserPropertyField[],
): UserPropertyField[] {
    if (sessionFields.length === 0) {
        return autocomplete;
    }
    const seenIds = new Set(autocomplete.map((field) => field.id));
    const seenKeys = new Set(autocomplete.map((field) => `${field.object_type}:${field.name}`));
    const additions = sessionFields.filter(
        (field) => !seenIds.has(field.id) && !seenKeys.has(`${field.object_type}:${field.name}`));
    return additions.length ? [...autocomplete, ...additions] : autocomplete;
}

interface TestButtonProps {
    onClick: () => void;
    disabled: boolean;
    disabledTooltip?: string;

    /** Override the default "Test access rule" label. Used by the
     *  permission-rule editors to surface "Simulate rules" instead,
     *  matching the dual-lane simulation modal they open. */
    label?: React.ReactNode;
}

interface AddAttributeButtonProps {
    onClick: () => void;
    disabled: boolean;
}

interface HelpTextProps {
    message: string;
    onLearnMoreClick?: () => void;
}

export function TestButton({onClick, disabled, disabledTooltip, label}: TestButtonProps): JSX.Element {
    const button = (
        <Button
            emphasis='tertiary'
            size='sm'
            onClick={onClick}
            disabled={disabled}
        >
            <i className='icon icon-lock-outline'/>
            {label ?? (
                <FormattedMessage
                    id='admin.access_control.table_editor.test_access_rule'
                    defaultMessage='Test access rule'
                />
            )}
        </Button>
    );

    if (disabled && disabledTooltip) {
        return (
            <WithTooltip title={disabledTooltip}>
                {button}
            </WithTooltip>
        );
    }

    return button;
}

export function AddAttributeButton({onClick, disabled}: AddAttributeButtonProps): JSX.Element {
    return (
        <Button
            emphasis='tertiary'
            size='sm'
            onClick={onClick}
            disabled={disabled}
        >
            <i className='icon icon-plus'/>
            <FormattedMessage
                id='admin.access_control.table_editor.add_attribute'
                defaultMessage='Add attribute'
            />
        </Button>
    );
}

export function HelpText({message, onLearnMoreClick}: HelpTextProps): JSX.Element {
    return (
        <div className='editor__help-text'>
            <Markdown
                message={message}
                options={{mentionHighlight: false}}
            />
            {onLearnMoreClick && (
                <a
                    href='#'
                    className='editor__learn-more'
                    onClick={onLearnMoreClick}
                >
                    <FormattedMessage
                        id='admin.access_control.table_editor.learnMore'
                        defaultMessage='Learn more about creating access expressions with examples.'
                    />
                </a>
            )}
        </div>
    );
}
