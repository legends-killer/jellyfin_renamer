/*
 * @Author: legends-killer
 * @Date: 2023-07-29 13:34:48
 * @LastEditors: legends-killer
 * @LastEditTime: 2023-07-29 22:30:52
 * @Description: 
 */
const fetch = require('node-fetch');
const CONFIG = require('./config.json');
const AUTH_HEADER = `MediaBrowser Token="${CONFIG.API_KEY}"`;
const fs = require('fs');
const path = require('path');
const lastRename = require('./lastRename.json');

const fetchUrl = async (url, method, body) => {
  const headers = {
    'Authorization': AUTH_HEADER
  }
  if (method === "POST") {
    headers['Content-Type'] = 'application/json'
  }
  let res
  try {
    res = await fetch(url, {
      method,
      body,
      headers
    })
  } catch (error) {
    console.log(error)
  }
  if (method === "POST") return res
  return res.json();
}

const rename = (metadata) => {
  metadata.Name = metadata.Path.split('/').pop()
  return metadata
}

const getItemMetadata = async (id) => {
  return await fetchUrl(`${CONFIG.BASE_URL}/Users/${CONFIG.USER_ID}/Items/${id}`, 'GET');
}

const walkThrough = async (id) => {
  const currentFolder = await fetchUrl(`${CONFIG.BASE_URL}/Users/${CONFIG.USER_ID}/Items?ParentId=${id}`, 'GET');
  for await (const ele of currentFolder.Items) {
    if (ele.Type === 'Folder') {
      await walkThrough(ele.Id);
    } else {
      if (lastRename[ele.Id]) {
        console.log(ele.Name, 'SKIP')
        continue
      }
      const metadata = await getItemMetadata(ele.Id);
      const newMetadata = rename(metadata);
      const res = await fetchUrl(`${CONFIG.BASE_URL}/Items/${ele.Id}`, 'POST', JSON.stringify(newMetadata));
      if (res.status === 204) Object.assign(lastRename, { [ele.Id]: metadata.Name })
      console.log(ele.Id, newMetadata.Name, res.status === 204 ? 'SUCCESS' : 'FAILED')
      console.log('-------------------------------')
    }
  }
}

const work = async () => {
  const mediaFolders = await fetchUrl(`${CONFIG.BASE_URL}/Users/${CONFIG.USER_ID}/Items`, 'GET');
  const promises = []
  for (const ele of mediaFolders.Items) {
    promises.push(walkThrough(ele.Id));
  }
  return Promise.all(promises)
}

const main = async () => {
  await work()
  console.log(lastRename)
  fs.writeFileSync(path.join(__dirname, 'lastRename.json'), JSON.stringify(lastRename, null, 2), {
    encoding: "utf8",
    flag: "w+",
  })
}

main()


