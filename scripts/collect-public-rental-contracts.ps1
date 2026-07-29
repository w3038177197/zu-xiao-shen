param([string]$OutputRoot = "$PSScriptRoot\..\public\dataset\rental-contracts")

$ErrorActionPreference = 'Stop'
$queries = @(
  '住房租赁合同 filetype:pdf site:gov.cn',
  '房屋租赁合同 示范文本 filetype:pdf site:gov.cn',
  '住房租赁合同 示范文本 住建局',
  '房屋租赁合同 示范文本 市场监督管理局',
  '租赁合同 示范文本 公共机构'
)
$allow = 'gov\.cn|samr\.gov\.cn|gov\.hk|gov\.mo|edu\.cn'
New-Item -ItemType Directory -Force $OutputRoot | Out-Null
$records = @()
foreach ($query in $queries) {
  $rss = "https://cn.bing.com/search?format=rss&q=$([uri]::EscapeDataString($query))"
  try { $xml = [xml](Invoke-WebRequest -UseBasicParsing -Uri $rss -Headers @{ 'User-Agent'='Mozilla/5.0' } -TimeoutSec 30).Content } catch { continue }
  foreach ($item in @($xml.rss.channel.item)) {
    $url = [string]$item.link
    try { $host = ([uri]$url).Host } catch { continue }
    if ($host -notmatch $allow) { continue }
    $safe = ($host + '_' + ([uri]$url).AbsolutePath.Trim('/') -replace '[^A-Za-z0-9._-]', '_')
    if ($safe.Length -gt 130) { $safe = $safe.Substring(0,130) }
    $ext = if ($url -match '(?i)\.pdf($|\?)') { '.pdf' } else { '.html' }
    $path = Join-Path $OutputRoot ($safe + $ext)
    if (Test-Path $path) { continue }
    try {
      Invoke-WebRequest -UseBasicParsing -Uri $url -Headers @{ 'User-Agent'='Mozilla/5.0' } -TimeoutSec 40 -OutFile $path
      $hash = (Get-FileHash $path -Algorithm SHA256).Hash
      $records += [pscustomobject]@{ title=[string]$item.title; source_url=$url; local_file=(Split-Path $path -Leaf); sha256=$hash; fetched_at=(Get-Date).ToUniversalTime().ToString('o') }
    } catch { if (Test-Path $path) { Remove-Item -LiteralPath $path -Force } }
  }
}
$records | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 (Join-Path $OutputRoot 'crawl-manifest.json')
Write-Output "Downloaded $($records.Count) public candidates to $OutputRoot"
