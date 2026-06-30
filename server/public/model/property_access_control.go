// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "context"

// AccessControlContextKey is the type for access control context keys.
type AccessControlContextKey string

// AccessControlCallerIDContextKey is the context key for access control caller ID.
const AccessControlCallerIDContextKey AccessControlContextKey = "access_control_caller_id"

// AccessControlScopeContextKey is the context key for the caller's "acting-as"
// scope. The scope rides alongside the caller ID so a single owner (e.g. the
// SCIM plugin) can subdivide its access per external system (e.g. "entra").
const AccessControlScopeContextKey AccessControlContextKey = "access_control_scope"

// Well-known caller IDs for internal services that need to write property
// values on synced fields. These are set on the request context by the
// respective sync services so that the access control hook can identify them.
//
// The "system:" prefix contains a colon, which is not a valid character in a
// plugin ID (see IsValidPluginId). That guarantees these values cannot be
// forged by a plugin whose manifest ID is used as its caller ID.
//
// CallerIDLocalAdmin marks a request as originating from a local-mode
// (unrestricted) session, which has an empty Session.UserId but full admin
// privileges. HTTP handlers tag the rctx with this caller ID when
// Session().IsUnrestricted() is true, so the attribute validation hook's
// permission checker can grant admin privileges without a user lookup.
const (
	CallerIDLDAPSync   = "system:ldap_sync"
	CallerIDSAMLSync   = "system:saml_sync"
	CallerIDLocalAdmin = "system:local_admin"
)

// WithCallerID adds the caller ID to a context.Context for access control purposes.
func WithCallerID(ctx context.Context, callerID string) context.Context {
	return context.WithValue(ctx, AccessControlCallerIDContextKey, callerID)
}

// CallerIDFromContext extracts the caller ID from a context.Context.
// Returns the caller ID and true if found, or empty string and false if not.
func CallerIDFromContext(ctx context.Context) (string, bool) {
	if v := ctx.Value(AccessControlCallerIDContextKey); v != nil {
		if id, ok := v.(string); ok {
			return id, true
		}
	}
	return "", false
}

// PropertyWriteOptions carries per-call write context for property value
// writes made through the plugin API. It lets a plugin declare the scope it is
// acting as so the server can check it against a field's owners.
type PropertyWriteOptions struct {
	// ActingAsScope is the owner-defined scope label the caller is acting as
	// (e.g. "entra"). Empty means the caller is not acting as any scope.
	ActingAsScope string
}

// WithActingAsScope adds the caller's acting-as scope to a context.Context for
// access control purposes.
func WithActingAsScope(ctx context.Context, scope string) context.Context {
	return context.WithValue(ctx, AccessControlScopeContextKey, scope)
}

// ActingAsScopeFromContext extracts the caller's acting-as scope from a
// context.Context. Returns the scope and true if found, or empty string and
// false if not.
func ActingAsScopeFromContext(ctx context.Context) (string, bool) {
	if v := ctx.Value(AccessControlScopeContextKey); v != nil {
		if scope, ok := v.(string); ok {
			return scope, true
		}
	}
	return "", false
}
