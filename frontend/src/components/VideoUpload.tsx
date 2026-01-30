'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useUploadThing } from '@/lib/uploadthing'

interface VideoUploadProps {
  onUploadComplete: (url: string, fileKey: string, file: File) => void
  onUploadError?: (error: Error) => void
}

export default function VideoUpload({ onUploadComplete, onUploadError }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const { startUpload, isUploading } = useUploadThing('videoUploader', {
    onClientUploadComplete: (files) => {
      if (files && files.length > 0 && uploadedFile) {
        const file = files[0]
        setUploading(false)
        setProgress(0)
        onUploadComplete(file.url, file.key, uploadedFile)
        setUploadedFile(null)
      }
    },
    onUploadError: (error: Error) => {
      setUploading(false)
      setProgress(0)
      if (onUploadError) {
        onUploadError(error)
      }
    },
    onUploadProgress: (p) => {
      setProgress(p)
    },
  })

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploading(true)
      setUploadedFile(acceptedFiles[0])
      try {
        await startUpload(acceptedFiles)
      } catch (error) {
        setUploading(false)
        setUploadedFile(null)
        if (onUploadError && error instanceof Error) {
          onUploadError(error)
        }
      }
    }
  }, [startUpload, onUploadError])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.webm', '.avi'],
    },
    maxFiles: 1,
    maxSize: 512 * 1024 * 1024, // 512MB
    disabled: uploading || isUploading,
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-brand-500 bg-brand-500/10'
            : uploading || isUploading
            ? 'border-gray-600 bg-gray-800/50 cursor-not-allowed'
            : 'border-white/[0.12] hover:border-brand-500/50 hover:bg-white/[0.02]'
        }`}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
            uploading || isUploading ? 'bg-brand-500/20' : 'bg-white/[0.06]'
          }`}>
            {uploading || isUploading ? (
              <svg className="w-7 h-7 text-brand-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>
          
          {uploading || isUploading ? (
            <>
              <p className="text-brand-400 font-medium">Uploading video...</p>
              <div className="w-full max-w-xs bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-brand-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{Math.round(progress)}%</p>
            </>
          ) : isDragActive ? (
            <p className="text-brand-400 font-medium">Drop your video here...</p>
          ) : (
            <>
              <p className="text-gray-300 font-medium">
                Drag & drop your video file here
              </p>
              <p className="text-sm text-gray-500">
                or click to browse
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Supports MP4, MOV, WEBM (max 512MB)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
