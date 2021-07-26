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
                <img src={logo} className="App-logo" alt="logo"/>
                <div {...getRootProps()}>
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
                            Object.entries(data).map((key: any) => `<quiz><question type="category">
    <category>
        <text>$course$/top</text>
    </category>
</question>
<question type="category">
    <category>
        <text>$course$/top/${key[0]}</text>
    </category>
</question>${key[1].join('')}</quiz>
                                `).forEach((text: string, index: number) => {
                                const element = document.createElement("a");
                                const file = new Blob([text], {type: 'text/plain'});
                                element.href = URL.createObjectURL(file);
                                element.download = index + ".xml";
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
