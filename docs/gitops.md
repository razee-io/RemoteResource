# Git

The RemoteResource operator git backendService supports delivering contents from
both the GitHub and GitLab services by
[branch, tag, or commit](#1-branch-tag-or-commit),
 or [release artifact](#2-release).

## 1. Branch, Tag, or Commit

Provide:

* repo url (use one of following formats)
  * `https://github.com/razee-io/RemoteResource.git`
  * `git@github.com:razee-io/RemoteResource.git`
* ref - branch, commitId (short or full SHA), or tag name
* filePath
  * path/to/directory/*
  * path/to/directory/*.extension
  * path/to/directory/filename.extension
* personal access token (if not public)

**Github:**

Sample RR with branch:

Use `git` as backend service.
Provide inputs as git request options, specifying a branch name as ref.
Personal access token should be provided as a secret or in config map.

```yaml
apiVersion: "deploy.razee.io/v1alpha2"
kind: RemoteResource
metadata:
  name: <remote_resource_name>
  namespace: <namespace>
spec:
  clusterAuth:
    impersonateUser: razeedeploy
  backendService: git
  requests:
    - options:
        git:
          provider: 'github'
          repo: "https://github.com/razee-io/RemoteResource.git"
          ref: "main"
          filePath: "*.yaml"
        headers:
          Authorization:
            valueFrom:
              secretKeyRef:
                name: token
                namespace: <namespace>
                key: token
```

Sample Request Option with short SHA:

Specify commitID as ref.

```yaml
requests:
  - options:
      git:
        provider: 'github'
        repo: "https://github.com/razee-io/RemoteResource.git"
        ref: "e51187e"
        filePath: "*.yaml"
      headers:
        Authorization:
          valueFrom:
            secretKeyRef:
              name: token
              namespace: <namespace>
              key: token
```

Sample Request Option with Tag:

Specify tag as ref.

```yaml
requests:
  - options:
      git:
        provider: 'github'
        repo: "https://github.com/razee-io/RemoteResource.git"
        ref: "2.0.4"
        filePath: "*.yaml"
      headers:
        Authorization:
          valueFrom:
            secretKeyRef:
              name: token
              namespace: <namespace>
              key: token
```

Implementation detail:
(i.e. How provided inputs get mapped to api behind the scenes):

* `GET https://api.github.com/repos/{repo}/contents/{path}?ref={ref}`
provides list of raw download_url(s) for file(s)
* request to download_url to get file

**Gitlab:**

Sample Request Option with branch:

```yaml
requests:
  - options:
      git:
        provider: 'gitlab'
        repo: "https://gitlab.com/group2842/testproject.git"
        ref: "testingbranch"
        filePath: "folder/*.yaml"
      headers:
        Authorization:
          valueFrom:
            secretKeyRef:
              name: token
              namespace: <namespace>
              key: token
```

Alternatively you can specify a commit ID or tag name as ref.

Implementation detail:
(i.e. How provided inputs get mapped to api behind the scenes):

* `GET https://{host}/api/v4/projects/{repo}/repository/tree/?path={path}&ref=${ref}`
provides list of filename(s) for file(s)
* `GET https://{host}/api/v4/projects/{repo}/repository/files/{path}{filename}/raw?ref={ref}`
provides raw file for filename

## 2. Release

To get files from release assets.

Provide:

* repo url
* release tag name
* asset
  * *.extension
  * filename.extension
* personal access token (if not public)

**Github:**

Sample Request Option:

Specify asset as filePath.

```yaml
requests:
  - options:
      git:
        provider: 'github'
        repo: "https://github.com/razee-io/RemoteResource.git"
        release: "2.0.4"
        filePath: "resource.yaml"
      headers:
        Authorization:
          valueFrom:
            secretKeyRef:
              name: token
              namespace: <namespace>
              key: token
```

Implementation detail:
(i.e. How provided inputs get mapped to api behind the scenes):

* `GET https://api.github.com/repos/{repo}/releases/tags/{release}`
provides release assets in response.assets
* `GET https://api.github.com/repos/{repo}/releases/assets/${asset.id}`
provides raw file for asset.id,
Note header `Accept: application/octet-stream` set by default,
will override Accept header specified by user.

**Gitlab:**

Release asset links in Gitlab must be a URL that
returns a valid kubernetes configuration file.
Ex. `https://raw.githubusercontent.com/razee-io/
RemoteResource/master/kubernetes/RemoteResource/resource.yaml`
External URLS must not require headers.
Gitlab URLS must be from the same host because the GET
request for a Gitlab file will include the headers
specified for the remote resource.

Sample Request Option:

Specify asset as filePath.

```yaml
requests:
  - options:
      git:
        provider: 'gitlab'
        repo: "https://gitlab.com/group2842/testproject.git"
        release: "1.0.1"
        filePath: "*.yaml"
      headers:
        Authorization:
          valueFrom:
            secretKeyRef:
              name: token
              namespace: <namespace>
              key: token
```

Implementation detail:
(i.e. How provided inputs get mapped to api behind the scenes):

* `GET https://{host}/api/v4/projects/{repo}/releases/{release}/assets/links`
provides release assets urls
* If asset url is internal/from the same gitlab host, parse url and
`GET https://{host}/api/v4/projects/{repo}/repository/files/{path}{filename}/raw?ref={ref}`
provides raw file, otherwise request to asset.url to get file
Note: all headers will be removed for external urls
