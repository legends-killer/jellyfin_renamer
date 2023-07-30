/*
 * @Author: legends-killer
 * @Date: 2023-07-29 13:34:48
 * @LastEditors: legends-killer
 * @LastEditTime: 2023-07-30 13:59:16
 * @Description: 
 */
const fetch = require('node-fetch');
const CONFIG = require('./config.json');
const AUTH_HEADER = `MediaBrowser Token="${CONFIG.API_KEY}"`;
const fs = require('fs');
const path = require('path');
const lastRename = require('./lastRename.json');

const fetchUrl = async (url, method, body, getRaw) => {
  const headers = {
    'Authorization': AUTH_HEADER
  }
  if (method === "POST") {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, {
    method,
    body,
    headers
  })
  if (getRaw) return res
  return res.json();
}

const rename = async (metadata, aiRename) => {
  const fullName = metadata.Path.split('/').pop()
  if(!aiRename) return {...metadata, Name: fullName}
  const aiName = await fetchUrl(CONFIG.GLM_URL, 'POST', JSON.stringify({prompt: CONFIG.PROMPT + fullName + ' \n文件重命名助手：', history: []}));
  return {...metadata, Name: aiName.response.replace("文件重命名助手：", "")}
}

const getItemMetadata = async (id) => {
  return await fetchUrl(`${CONFIG.BASE_URL}/Users/${CONFIG.USER_ID}/Items/${id}`, 'GET');
}

const walkThrough = async (id, aiRename) => {
  const currentFolder = await fetchUrl(`${CONFIG.BASE_URL}/Users/${CONFIG.USER_ID}/Items?ParentId=${id}`, 'GET');
  for (const ele of currentFolder.Items) {
    if (ele.Type === 'Folder') {
      await walkThrough(ele.Id, aiRename);
    } else {
      if (lastRename[ele.Id]) {
        console.log(ele.Name, 'SKIP')
        continue
      }
      const metadata = await getItemMetadata(ele.Id);
      const newMetadata = await rename(metadata, aiRename);
      const res = await fetchUrl(`${CONFIG.BASE_URL}/Items/${ele.Id}`, 'POST', JSON.stringify(newMetadata), true);
      if (res.status === 204) Object.assign(lastRename, { [ele.Id]: {fullName: metadata.Name, aiName: newMetadata.Name} })
      console.log(ele.Id,metadata.Name,'---------->', newMetadata.Name, res.status === 204 ? 'SUCCESS' : 'FAILED')
    }
  }
}

const work = async () => {
  const mediaFolders = await fetchUrl(`${CONFIG.BASE_URL}/Users/${CONFIG.USER_ID}/Items`, 'GET');
  for (const ele of mediaFolders.Items) {
    await walkThrough(ele.Id, CONFIG.AI_RENAME_MEDIA_ID.includes(ele.Id.toString()));
  }
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


