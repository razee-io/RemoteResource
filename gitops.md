# Gitops

How to use Remote Resource gitops to deliver by:

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

Github Api:

* Get listing of files from branch/path provides raw download_url: `https://api.github.com/repos/{repo}/contents/{path}?ref={branch}`
* request to download_url to get file

Gitlab Api:

* Get listing of files from branch/path provides filenames: `https://{host}/api/v4/projects/{repo}/repository/tree/?path={path}&ref=${branch}`
* Get raw file with filename: `https://{host}/api/v4/projects/{repo}/repository/files/{path}{filename}/raw?ref={branch}`

## 2. Commit ID

Provide:

* repo url
* commitID (short or full)
* filePath
* personal access token (if not public)

Github Api:

* Same as Branch, but use Commit ID in place of branch
* Get listing of files with commitId/path: `https://api.github.com/repos/{repo}/contents/{path}?ref={commitId}`

## 3. GH Release

Provide:

* repo url
* release tag
* asset
  * *.extension
  * filename.extension
* personal access token (if not public)

Api:

* Get release assets with response.assets: `https://api.github.com/repos/{owner}/{repo}/releases/tags/{tag}`
* request to assets.browser_download_url to get file