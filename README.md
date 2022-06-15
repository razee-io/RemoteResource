# RemoteResource

[![Build Status](https://travis-ci.com/razee-io/RemoteResource.svg?branch=master)](https://travis-ci.com/razee-io/RemoteResource)
![GitHub](https://img.shields.io/github/license/razee-io/RemoteResource.svg?color=success)

RemoteResource is the foundation for implementing continuous deployment with
razeedeploy. It retrieves and applies the configuration for all resources.

## Install

[Razee Deploy Delta](https://github.com/razee-io/razeedeploy-delta) is the
recommended way to install RemoteResource.

## Customize the Controller

The optional `razeedeploy-config` ConfigMap can be used to customize the
controller.

Because the ConfigMap is optional, if it is created the first time, you must
restart controller pods, so the deployment can mount the ConfigMap
as a volume.

Example:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: razeedeploy-config
  namespace: razeedeploy
data:
  lock-cluster: "false"
  enable-impersonation: "false"
```

### Lock Cluster

Setting `lock-cluster` to "true" prevents the controller from updating
resources on the cluster.

### Enable User Impersonation

Setting `enable-impersonation` to "true" allows the controller to perform
[user impersonation](https://github.com/razee-io/RemoteResource#user-impersonation)
in all namespaces, if authenticated user is granted impersonation permission.

**IMPORTANT:** it is highly advised to set up [ImpersonationWebhook](https://github.com/razee-io/ImpersonationWebhook)
before enabling cluster-wide impersonation. Once the ImpersonationWebhook controller is installed
and all necessary config and authorizations in place, impersonation can be fully enabled from this
configmap. If ImpersonationWebhook is not installed before enabling impersonation, any user on the
cluster that is allowed to create razeedeploy resources will be able to impersonate any other user.

By default, `enable-impersonation` is `false`, and the controller only allows users 
to impersonate other users in the `razeedeploy` namespace. This is a short term
solution to support impersonation and limit privilege escalation (by limiting the action to
the `razeedeploy` namespace only).

## Resource Definition

### Sample

```yaml
apiVersion: "deploy.razee.io/v1alpha2"
kind: RemoteResource
metadata:
  name: <remote_resource_name>
  namespace: <namespace>
spec:
  clusterAuth:
    impersonateUser: razeedeploy
  backendService: generic
  requests:
    - options:
        url: https://<source_repo_url>/<file_name1>
        headers:
          <header_key1>: <header_value1>
          <header_key2>: <header_value2>
          <header_key3>:
            valueFrom:
              secretKeyRef:
                name: <name of secret resource>
                namespace: <optional namespace of secret resource>
                key: <key in secret>
    - optional: true
      options:
        url: http://<source_repo_url>/<file_name2>
```

### Spec

**Path:** `.spec`

**Description:** `spec` is required and **must** include section `requests`.

**Schema:**

```yaml
spec:
  type: object
  required: [requests]
  properties:
    clusterAuth:
      type: object
      ...
    backendService:
      type: string
      enum: [generic, s3]
    auth:
      type: object
      ...
    requests:
      type: array
      ...
```

### User Impersonation

**Path:** `.spec.clusterAuth.impersonateUser`

**Description:** [Impersonates](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#user-impersonation)
a user for the given resource. This includes all actions the controller must
make related to the resource (fetching envs, getting resources, applying
resources, etc.). ImpersonateUser only applies to the single RazeeDeploy
resource that it has been added to.

**Important:** [The impersonation webhook](https://github.com/razee-io/ImpersonationWebhook)
**must** be installed to perform permission validation. Only users with impersonation
permission can impersonate others. If the webhook is not installed, anyone can
impersonate others, and this will lead to privilege escalation.

**Schema:**

```yaml
clusterAuth:
  type: object
  properties:
    impersonateUser:
      type: string
```

**Default:** `'razeedeploy'`

### Backend Service

**Path:** `.spec.backendService`

**Description:** This field tells RemoteResource which service logic it should
use. Currently the choices are `generic` and `s3`, where `s3` has special logic
for using HMAC keys or IAM api keys for fetching access tokens.

**Schema:**

```yaml
backendService:
  type: string
  enum: [generic, s3]
```

**Default:** `'generic'`

### Auth: HMAC

**Path:** `.spec.auth.hmac`

**Description:** Allows you to connect to s3 buckets using an HMAC key/id pair.

**Note:** `.spec.backendService` must be set to `s3` for auth to take effect.

**Schema:**

```yaml
hmac:
  type: object
  allOf:
    - oneOf:
        - required: [accessKeyId]
        - required: [accessKeyIdRef]
    - oneOf:
        - required: [secretAccessKey]
        - required: [secretAccessKeyRef]
  properties:
    accessKeyId:
      type: string
    accessKeyIdRef:
      type: object
      required: [valueFrom]
      properties:
        valueFrom:
          type: object
          required: [secretKeyRef]
          properties:
            secretKeyRef:
              type: object
              required: [name, key]
              properties:
                name:
                  type: string
                namespace:
                  type: string
                key:
                  type: string
    secretAccessKey:
      type: string
    secretAccessKeyRef:
      type: object
      required: [valueFrom]
      properties:
        valueFrom:
          type: object
          required: [secretKeyRef]
          properties:
            secretKeyRef:
              type: object
              required: [name, key]
              properties:
                name:
                  type: string
                namespace:
                  type: string
                key:
                  type: string
```

### Auth: IAM

**Path:** `.spec.auth.iam`

**Description:** Allows you to connect to s3 buckets using an IAM provider and
api key.

**Note:** `.spec.backendService` must be set to `s3` for auth to take effect.

- Sample values for [IBM Cloud Object Storage](https://cloud.ibm.com/docs/services/cloud-object-storage/cli?topic=cloud-object-storage-curl)
  - grant_type: "urn:ibm:params:oauth:grant-type:apikey"
  - url: "[https://iam.cloud.ibm.com/identity/token](https://iam.cloud.ibm.com/identity/token)"

**Schema:**

```yaml
iam:
  type: object
  allOf:
    - required: [url, grantType]
    - oneOf:
        - required: [apiKey]
        - required: [apiKeyRef]
  properties:
    grantType:
      type: string
    url:
      type: string
      format: uri
    apiKey:
      type: string
    apiKeyRef:
      type: object
      required: [valueFrom]
      properties:
        valueFrom:
          type: object
          required: [secretKeyRef]
          properties:
            secretKeyRef:
              type: object
              required: [name, key]
              properties:
                name:
                  type: string
                namespace:
                  type: string
                key:
                  type: string
```

### Request Options

**Path:** `.spec.requests[].options`

**Description:** All options defined in an options object will be passed as-is
to the http request. This means you can specify things like headers for
authentication in this section. See [RemoteResourceS3](https://github.com/razee-io/RemoteResourceS3)
for authenticating with an S3 object store.

**Note:** You can reference secret data in your header options by setting the value
of any key in the headers to be `valueFrom.secretKeyRef`.
ie. `.spec.requests[].options.headers.<yourHeaderKey> =`
`.valueFrom.secretKeyRef.{name, namespace, key}`

**Schema:**

```yaml
options:
  type: object
  oneOf:
    - required: [url]
    - required: [uri]
  properties:
    url:
      type: string
      format: uri
    uri:
      type: string
      format: uri
    headers:
      type: object
      x-kubernetes-preserve-unknown-fields: true
```

### Optional Request

**Path:** `.spec.requests[].optional`

**Description:** if download or applying child resource fails, RemoteResource
will stop execution and report error to `.status`. You can allow execution to
continue by marking a reference as optional.

**Schema:**

```yaml
optional:
  type: boolean
```

**Default:** `false`

### Download Directory Contents

- If `.spec.backendService` is set to `s3` and url ends with `/`, we will assume
  this is an S3 directory and will attempt to download all resources in the directory.
- Every resource within the directory will be downloaded using the `.spec.requests[].options`
  provided with the directory url.
- Path must follow one of:
  - `http://s3.endpoint.com/bucket/path/to/your/resources/`
  - `http://bucket.s3.endpoint.com/path/to/your/resources/`

### Managed Resource Labels

#### Reconcile

Child resource: `.metadata.labels[deploy.razee.io/Reconcile]`

- DEFAULT: `true`
  - A razeedeploy resource (parent) will clean up a resources it applies (child)
    when either the child is no longer in the parent resource definition or the
    parent is deleted.
- `false`
  - This behavior can be overridden when a child's resource definition has
    the label `deploy.razee.io/Reconcile=false`.

#### Resource Update Mode

Child resource: `.metadata.labels[deploy.razee.io/mode]`

Razeedeploy resources default to merge patching children. This behavior can be
overridden when a child's resource definition has the label
`deploy.razee.io/mode=<mode>`

Mode options:

- DEFAULT: `Apply` (`MergePatch`)
  - A simple merge, that will merge objects and replace arrays. Items previously
    defined, then removed from the definition, will be removed from the live resource.
  - "As defined in [RFC7386](https://tools.ietf.org/html/rfc7386), a Merge Patch
    is essentially a partial representation of the resource. The submitted JSON is
    "merged" with the current resource to create a new one, then the new one is
    saved. For more details on how to use Merge Patch, see the RFC." [Reference](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#patch-operations)
- `StrategicMergePatch`
  - A more complicated merge, the kubernetes apiServer has defined keys to be
    able to intelligently merge arrays it knows about.
  - "Strategic Merge Patch is a custom implementation of Merge Patch. For a
    detailed explanation of how it works and why it needed to be introduced, see
    [StrategicMergePatch](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-api-machinery/strategic-merge-patch.md)."
    [Reference](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#patch-operations)
  - [Kubectl Apply Semantics](https://kubectl.docs.kubernetes.io/pages/app_management/field_merge_semantics.html)
- `AdditiveMergePatch`
  - Similar to the default `Apply` (`MergePatch`), this is a simple merge, that
    will merge objects and replace arrays. The difference is that it will
    not remove fields from the live resource when they are removed from the
    definition. eg. This will only add/update fields, it wont remove fields.
  - If you are using this mode and find that you need to remove a field, you can
    do so manually, by setting the field in the yaml defintion to have a value
    of `null`. When the null value is merged with the live resource, it will
    effectively delete the field.
  - This mode is useful if you have very large resources and require that the
    `last-applied-configuration` annotation is not injected into the resource.
- `EnsureExists`
  - Will ensure the resource is created and is replaced if deleted. Will not
    enforce a definition.

### Debug Individual Resource

`.spec.resources.metadata.labels[deploy.razee.io/debug]`

Treats the live resource as EnsureExist. If any razeedeploy component is enforcing
the resource, and the label `deploy.razee.io/debug: true` exists on the live
resource, it will treat the resource as ensure exist and not override any changes.
This is useful for when you need to debug a live resource and don't want razeedeploy
overriding your changes. Note: this will only work when you add it to live resources.
If you want to have the EnsureExist behavior, see [Resource Update Mode](#Resource-Update-Mode).

- ie: `kubectl label rr <your-rr> deploy.razee.io/debug=true`
