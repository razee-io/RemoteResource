# Git

The RemoteResource operator git backendService supports delivering contents from
both the GitHub and GitLab services by [branch](#1-branch-implemented),
 [tag](#2-commit-id-sha-or-tag),
 [commit](#2-commit-id-sha-or-tag),
 or [release artifact](#3-gh-release-not-implemented).

## 1. Branch (implemented)

Provide:

* repo url (use one of following formats)
  * `https://github.com/razee-io/RemoteResource.git`
  * `git@github.com:razee-io/RemoteResource.git`
* branch
* filePath
  * path/to/directory/*
  * path/to/directory/*.extension
  * path/to/directory/filename.extension
* personal access token (if not public)

**Github:**

Sample RR:

Use `git` as backend service.
Provide inputs as git request option.
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
          branch: "master"
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

* `GET https://api.github.com/repos/{repo}/contents/{path}?ref={branch}`
provides list of raw download_url(s) for file(s)
* request to download_url to get file

**Gitlab:**

Sample Request Option:

```yaml
requests:
  - options:
      git:
        provider: 'gitlab'
        repo: "https://gitlab.com/group2842/testproject.git"
        branch: "testing"
        filePath: "folder/*.yaml"
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

* `GET https://{host}/api/v4/projects/{repo}/repository/tree/?path={path}&ref=${branch}`
provides list of filename(s) for file(s)
* `GET https://{host}/api/v4/projects/{repo}/repository/files/{path}{filename}/raw?ref={branch}`
provides raw file for filename

## 2. Commit ID (SHA or Tag)

Provide:

* repo url
* commitID (short or full SHA or release tag name)
* filePath
* personal access token (if not public)

**Github:**

Sample Request Option with short SHA:

Specify commitID as branch name

```yaml
requests:
  - options:
      git:
        provider: 'github'
        repo: "https://github.com/razee-io/RemoteResource.git"
        branch: "e51187e"
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

Specify tag as branch name

```yaml
requests:
  - options:
      git:
        provider: 'github'
        repo: "https://github.com/razee-io/RemoteResource.git"
        branch: "2.0.4"
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

* Same as Branch, but use commitId/tag in place of branch
* `GET https://api.github.com/repos/{repo}/contents/{path}?ref={commitId}`
provides list of raw download_url(s) for file(s)

## 3. GH Release (not implemented)

To get files from release assets.

Provide:

* repo url
* release tag name
* asset
  * *.extension
  * filename.extension
* personal access token (if not public)

Sample Request Option:

```yaml
requests:
  - options:
      git:
        provider: 'github'
        repo: "https://github.com/razee-io/RemoteResource.git"
        release: "2.0.4"
        asset: "resource.yaml"
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

* `GET https://api.github.com/repos/{owner}/{repo}/releases/tags/{release}`
provides release assets in response.assets
* request to assets.browser_download_url to get file
