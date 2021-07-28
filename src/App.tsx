import logo from './logo.svg';
import './App.css';
import React, {useCallback, useState} from 'react'
import {useDropzone} from 'react-dropzone'
import readFiles from './ZipReader'
import {Button} from "@material-ui/core";

function App() {
    const onDrop = useCallback(acceptedFiles => {
        // Do something with the files
        readFiles(acceptedFiles, setData)
    }, [])
    const [data, setData] = useState([])
    const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})

    return (
        <div className="App">

            <header className="App-header">
                <div {...getRootProps()}>
                    <img src={logo} className="App-logo" alt="logo"/>
                    <input {...getInputProps()} />
                    {
                        isDragActive ?
                            <p>Drop the files here ...</p> :
                            <p>Drag 'n' drop some files here, or click to select files</p>
                    }
                </div>
                <Button
                    variant='contained'
                    color='primary'
                    disabled={Object.entries(data).length === 0}
                    onClick={
                        () => {
                            Object.entries(data).forEach((obj: any) => {
                                const element = document.createElement("a");
                                const file = new Blob([obj[1]], {type: 'text/plain'});
                                element.href = URL.createObjectURL(file);
                                element.download = obj[0].replace('.zip', '') + ".xml";
                                document.body.appendChild(element); // Required for this to work in FireFox
                                element.click()
                            })
                        }
                    }
                >Download</Button>
            </header>
        </div>
    );
}

export default App;
