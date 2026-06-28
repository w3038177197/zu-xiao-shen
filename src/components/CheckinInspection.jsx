import { useEffect, useMemo, useState } from 'react'
import { Download, Sparkles, UploadCloud } from 'lucide-react'
import { STORAGE_KEYS } from '../constants/appConfig.js'
import { LEGAL_DISCLAIMER } from '../constants/legal.js'
import {
  CHECKIN_MAX_PHOTO_BYTES,
  CHECKIN_MAX_PHOTOS_PER_ITEM,
  CHECKIN_PHOTO_MAX_EDGE,
  CHECKIN_PHOTO_QUALITY,
  checkinItems,
  checkinRoomTypes,
  checkinRooms,
} from '../constants/checkinConfig.js'
import {
  createDefaultCheckinState,
  getCheckinDefectRows,
  getCheckinStats,
  loadCheckinInspectionState,
  normalizeCheckinRecord,
} from '../features/checkinInspection.js'

export default function CheckinInspection({ onStatus }) {
  const [roomType, setRoomType] = useState('studio')
  const [activeRoom, setActiveRoom] = useState(checkinRooms[0].key)
  const [checkinData, setCheckinData] = useState(() => loadCheckinInspectionState())
  const [report, setReport] = useState('')
  const [isExportingCheckinDocx, setIsExportingCheckinDocx] = useState(false)

  const stats = useMemo(() => getCheckinStats(checkinData), [checkinData])
  const defectRows = useMemo(() => getCheckinDefectRows(checkinData), [checkinData])
  const selectedRoomType = checkinRoomTypes.find((item) => item.value === roomType)?.label || '租住房屋'
  const activeRoomLabel = checkinRooms.find((room) => room.key === activeRoom)?.label || '当前房间'

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.checkinInspection, JSON.stringify(checkinData))
    } catch {
      onStatus('验房照片较多，本地保存空间不足，请删除部分照片后再继续')
    }
  }, [checkinData, onStatus])

  const updateRecord = (roomKey, itemKey, patch) => {
    setCheckinData((current) => ({
      ...current,
      [roomKey]: {
        ...current[roomKey],
        [itemKey]: {
          ...normalizeCheckinRecord(current[roomKey]?.[itemKey]),
          ...patch,
        },
      },
    }))
  }

  const uploadCheckinPhotos = async (roomKey, item, files) => {
    const incomingFiles = Array.from(files || [])
    const selectedFiles = incomingFiles.filter((file) => file.type.startsWith('image/'))
    const acceptedFiles = selectedFiles.filter((file) => file.size <= CHECKIN_MAX_PHOTO_BYTES)
    const currentPhotos = checkinData[roomKey]?.[item.key]?.photos || []
    const availableSlots = Math.max(0, CHECKIN_MAX_PHOTOS_PER_ITEM - currentPhotos.length)
    const filesToRead = acceptedFiles.slice(0, availableSlots)
    const roomLabel = checkinRooms.find((room) => room.key === roomKey)?.label || activeRoomLabel
    const oversizedCount = selectedFiles.length - acceptedFiles.length
    const skippedByLimit = Math.max(0, acceptedFiles.length - filesToRead.length)

    if (!selectedFiles.length) {
      onStatus('请选择图片格式的验房照片')
      return
    }
    if (!filesToRead.length) {
      onStatus(oversizedCount ? '照片超过 6MB，请压缩后再上传' : `${roomLabel}-${item.label} 已达到 ${CHECKIN_MAX_PHOTOS_PER_ITEM} 张照片上限`)
      return
    }

    try {
      const { compressImageToDataUrl } = await import('../utils/imageTools.js')
      const photos = await Promise.all(
        filesToRead.map(async (file) => ({
          id: `${Date.now()}-${file.name}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          url: await compressImageToDataUrl(file, {
            maxEdge: CHECKIN_PHOTO_MAX_EDGE,
            quality: CHECKIN_PHOTO_QUALITY,
          }),
          createdAt: new Date().toLocaleString(),
        })),
      )

      setCheckinData((current) => {
        const currentRecord = normalizeCheckinRecord(current[roomKey]?.[item.key])

        return {
          ...current,
          [roomKey]: {
            ...current[roomKey],
            [item.key]: {
              ...currentRecord,
              photos: [...currentRecord.photos, ...photos].slice(0, CHECKIN_MAX_PHOTOS_PER_ITEM),
              note: currentRecord.note || (currentRecord.status === 'defect' ? '' : `已上传${roomLabel}-${item.label}照片`),
            },
          },
        }
      })

      const skippedText = [
        oversizedCount ? `${oversizedCount} 张超过 6MB 已跳过` : '',
        skippedByLimit ? `${skippedByLimit} 张超过上限未添加` : '',
      ].filter(Boolean).join('，')
      onStatus(`已上传 ${photos.length} 张${roomLabel}-${item.label}照片${skippedText ? `，${skippedText}` : ''}`)
    } catch {
      onStatus('照片读取失败，请重新选择图片')
    }
  }

  const removeCheckinPhoto = (roomKey, itemKey, photoId) => {
    const currentPhotos = checkinData[roomKey]?.[itemKey]?.photos || []
    updateRecord(roomKey, itemKey, {
      photos: currentPhotos.filter((photo) => photo.id !== photoId),
    })
    onStatus('已删除验房照片')
  }

  const resetCheckin = () => {
    setCheckinData(createDefaultCheckinState())
    setReport('')
    onStatus('入住验房记录已重置')
  }

  const generateReport = () => {
    const defectSummary = defectRows.length
      ? defectRows.map((row) => `${row.room}-${row.item}：${row.defect}（${row.note}；照片${row.photoCount}张）`).join('\n')
      : '本次验房未记录明显瑕疵。'
    const nextReport = [
      '租小审入住验房报告',
      `生成时间：${new Date().toLocaleString()}`,
      `房屋类型：${selectedRoomType}`,
      `验房完成度：${stats.checked}/${stats.total}`,
      `疑似瑕疵：${stats.defects} 处`,
      `已上传照片：${stats.photos} 张`,
      '',
      '一、瑕疵记录',
      defectSummary,
      '',
      '二、发给房东/中介的确认话术',
      defectRows.length
        ? `您好，我今天入住${selectedRoomType}时已按房间拍摄并整理验房记录。记录中标注了${defectRows.slice(0, 3).map((row) => row.defect).join('、')}等疑似入住前已存在情况。麻烦确认这些问题为入住时现状，后续退租时不作为我的责任扣除押金。`
        : `您好，我今天入住${selectedRoomType}时已按房间拍摄了入住验房照片。当前未发现明显瑕疵，我会保留全屋照片和水电燃气表读数，作为退租时双方核对的基准。麻烦确认收到，谢谢。`,
      '',
      LEGAL_DISCLAIMER,
    ].join('\n')

    setReport(nextReport)
    onStatus(`入住验房报告已生成，发现 ${stats.defects} 处疑似瑕疵`)
  }

  const exportReport = async () => {
    if (isExportingCheckinDocx) return

    const content = report || '请先生成入住验房报告。'
    setIsExportingCheckinDocx(true)
    onStatus('正在生成 Word 入住验房报告')

    try {
      const { downloadTextDocx } = await import('../utils/docxExport.js')
      await downloadTextDocx('租小审-入住验房报告', content)
      onStatus('入住验房报告已生成 DOCX，可下载 Word')
    } catch (error) {
      onStatus(`入住验房报告 DOCX 生成失败：${error.message}`)
    } finally {
      setIsExportingCheckinDocx(false)
    }
  }

  return (
    <div className="checkin-inspection">
      <section className="checkin-hero work-panel">
        <div>
          <p className="section-kicker">Check-in Inspection</p>
          <h2>入住当天先验房，退租时才有对比基准</h2>
          <p>按房屋类型和房间逐项记录状态，疑似瑕疵会自动汇总成房东确认话术和验房报告。</p>
          <div className="checkin-hero-actions">
            <button className="primary-button" type="button" onClick={generateReport}>
              <Sparkles size={17} aria-hidden="true" />
              生成验房报告
            </button>
            <button className="ghost-button" type="button" onClick={exportReport} disabled={isExportingCheckinDocx}>
              <Download size={17} aria-hidden="true" />
              {isExportingCheckinDocx ? '正在生成 Word' : '导出 Word 报告'}
            </button>
          </div>
        </div>
        <div className={`evidence-score ${stats.percent >= 80 ? 'safe' : stats.percent >= 50 ? 'warning' : 'danger'}`}>
          <strong>{stats.percent}%</strong>
          <span>验房完成度</span>
          <em>{stats.defects} 处疑似瑕疵</em>
        </div>
      </section>

      <section className="work-panel checkin-type-panel">
        <div className="panel-head compact">
          <div>
            <h2>选择房屋类型</h2>
            <p>不同房源重点不同，整租看全屋，合租要看公共区边界。</p>
          </div>
        </div>
        <div className="checkin-type-grid">
          {checkinRoomTypes.map((item) => (
            <button className={roomType === item.value ? 'active' : ''} key={item.value} type="button" onClick={() => setRoomType(item.value)}>
              <strong>{item.label}</strong>
              <span>{item.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="work-panel checkin-workbench">
        <div className="panel-head compact">
          <div>
            <h2>逐房间验房记录</h2>
            <p>标记正常、疑似瑕疵，并补充具体说明。</p>
          </div>
          <button className="ghost-button compact-button" type="button" onClick={resetCheckin}>
            重置验房
          </button>
        </div>
        <div className="checkin-room-tabs" role="tablist" aria-label="验房房间">
          {checkinRooms.map((room) => {
            const defectCount = checkinItems.filter((item) => checkinData[room.key][item.key].status === 'defect').length
            return (
              <button className={activeRoom === room.key ? 'active' : ''} key={room.key} type="button" onClick={() => setActiveRoom(room.key)}>
                {room.label}
                {defectCount > 0 && <em>{defectCount}</em>}
              </button>
            )
          })}
        </div>
        <div className="checkin-item-list">
          {checkinItems.map((item) => {
            const record = normalizeCheckinRecord(checkinData[activeRoom]?.[item.key])
            const inputValue = record.status === 'defect' ? record.defect : record.note
            return (
              <article className={`checkin-item ${record.status}`} key={item.key}>
                <div className="checkin-item-main">
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
                </div>
                <div className="checkin-status-row">
                  {[
                    { value: 'good', label: '正常' },
                    { value: 'defect', label: '有瑕疵' },
                    { value: 'unchecked', label: '待确认' },
                  ].map((option) => (
                    <button
                      className={record.status === option.value ? 'active' : ''}
                      key={option.value}
                      type="button"
                      onClick={() => updateRecord(activeRoom, item.key, { status: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="checkin-detail-cell">
                  <input
                    value={inputValue}
                    onChange={(event) =>
                      updateRecord(activeRoom, item.key, record.status === 'defect' ? { defect: event.target.value } : { note: event.target.value })
                    }
                    placeholder={record.status === 'defect' ? item.defectPlaceholder : item.notePlaceholder}
                  />
                  <p className="checkin-item-advice">{record.status === 'defect' ? item.defectAdvice : item.photoHint}</p>
                  {record.status === 'defect' ? (
                    <div className="checkin-defect-tips" aria-label={`${item.label}瑕疵留证建议`}>
                      {item.defectSuggestions.map((suggestion) => (
                        <span key={suggestion}>{suggestion}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="checkin-photo-tools">
                    <label className="checkin-inline-upload">
                      <UploadCloud size={15} aria-hidden="true" />
                      <span>{record.photos.length ? `继续上传照片 (${record.photos.length}/${CHECKIN_MAX_PHOTOS_PER_ITEM})` : '上传该部位照片'}</span>
                      <input
                        accept="image/*"
                        multiple
                        type="file"
                        onChange={(event) => {
                          uploadCheckinPhotos(activeRoom, item, event.target.files)
                          event.target.value = ''
                        }}
                      />
                    </label>
                    <small>{item.photoHint}</small>
                  </div>
                  {record.photos.length ? (
                    <div className="checkin-inline-photos" aria-label={`${activeRoomLabel}-${item.label}照片`}>
                      {record.photos.map((photo, index) => (
                        <figure key={photo.id}>
                          <img alt={`${activeRoomLabel}${item.label}验房照片${index + 1}`} src={photo.url} />
                          <figcaption>
                            <strong>照片 {index + 1}</strong>
                            <span>{photo.createdAt || photo.name}</span>
                          </figcaption>
                          <button type="button" onClick={() => removeCheckinPhoto(activeRoom, item.key, photo.id)}>
                            删除
                          </button>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="work-panel checkin-report-panel">
        <div className="panel-head compact">
          <div>
            <h2>押金自保验房报告</h2>
            <p>生成后可作为退租证据包里的“入住状态基准”。</p>
          </div>
        </div>
        {report ? (
          <div className="checkin-report-grid">
            <div className="checkin-report-summary">
              <strong>{stats.defects} 处</strong>
              <span>疑似瑕疵已记录</span>
              <p>{stats.checked}/{stats.total} 项完成验房，已上传 {stats.photos} 张照片</p>
            </div>
            <div className="checkin-defect-list">
              {defectRows.length ? (
                defectRows.map((row) => (
                  <div key={`${row.room}-${row.item}`}>
                    <strong>{row.room} · {row.item}</strong>
                    <span>{row.defect}，{row.note}，照片 {row.photoCount} 张</span>
                  </div>
                ))
              ) : (
                <div>
                  <strong>暂无明显瑕疵</strong>
                  <span>建议仍保留全屋照片和表读数。</span>
                </div>
              )}
            </div>
            <div className="communication-preview checkin-script">
              <pre>{report}</pre>
            </div>
          </div>
        ) : (
          <p className="empty-note">点击“生成验房报告”后，这里会展示瑕疵汇总和可发给房东的确认话术。</p>
        )}
      </section>
    </div>
  )
}
